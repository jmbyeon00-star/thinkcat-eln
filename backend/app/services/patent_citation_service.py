import os
import json
import joblib
import numpy as np
import pandas as pd
import statsmodels.api as sm
from datetime import datetime
from sqlalchemy.orm import Session
from pathlib import Path

# ★ SQLAlchemy 모델 임포트 (프로젝트 실제 경로에 맞추세요)
from app.models.techdna_input import TechdnaIpforce  # STANINE_TECHDNA
from app.models.patent_model import PatentData        # PATENT_DATA_TB

# ===== 환경 변수 (경로 커스터마이징) =====
SERVICE_DIR = Path(__file__).parent
DATA_DIR = SERVICE_DIR / "data"
MODEL_DIR = SERVICE_DIR / "model"
SCALER_DIR = SERVICE_DIR / "stdSc"
MODEL_PATH = os.getenv("CITPRED_MODEL_PATH", MODEL_DIR / "poisson_model(251002).joblib")
THRESHOLDS_PATH = os.getenv("CITPRED_THRESHOLDS_PATH", DATA_DIR / "stanine_thresholds_zscore.json")


# ===============================
# 1) fetch_techdna_and_biblio
# ===============================
def fetch_techdna_and_biblio(app_number, conn: Session):
    """
    Flask의 pymysql 버전을 SQLAlchemy 세션 기반으로 변경.
    - techdna: STANINE_TECHDNA
    - biblio : PATENT_DATA_TB (grant_date 사용)
    반환은 원래 코드처럼 dict 2개 (techdna, biblio)
    """
    try:
        techdna_row = (
            conn.query(TechdnaIpforce)
            .filter(TechdnaIpforce.application_number == app_number)
            .order_by(TechdnaIpforce.application_number.desc())
            .first()
        )
        
        if not techdna_row:
            return None, None

        biblio_row = (
            conn.query(PatentData)
            .filter(PatentData.application_number == app_number)
            .first()
        )

        # dict 형태로 변환 (원래 Flask 코드와 호환)
        techdna = {
            "application_number": str(techdna_row.application_number),
            "main_ipc": techdna_row.main_ipc,
            "after_regi_year": techdna_row.after_regi_year,
            "rightholder_ch_cnt": techdna_row.rightholder_ch_cnt,
            "f_cit_cnt": techdna_row.f_cit_cnt,
            "last_modified_date": _to_datetime(techdna_row.last_modified_date),
        }

        biblio = None
        if biblio_row:
            biblio = {
                "application_number": str(biblio_row.application_number),
                "grant_date": _to_datetime(biblio_row.grant_date),
            }
        
        return techdna, biblio
        
    except Exception as e:
        print(f"[fetch] 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None


def _to_datetime(v):
    if v is None:
        return None
    if isinstance(v, (datetime, )):
        return v
    s = str(v)
    if len(s) == 8 and s.isdigit():
        return datetime.strptime(s, "%Y%m%d")
    try:
        return pd.to_datetime(s)
    except Exception:
        return None


# ===============================
# 2) preprocess_inputs
# ===============================
def preprocess_inputs(techdna, biblio):
    techdna_df = pd.DataFrame([techdna])
    biblio_df = pd.DataFrame([biblio])
    total = pd.merge(techdna_df, biblio_df, on="application_number")

    total["연차수"] = total["after_regi_year"]
    total["log(누적피인용수)"] = np.log1p(total["f_cit_cnt"])

    total["last_modified_date"] = pd.to_datetime(total["last_modified_date"])
    total["grant_date"] = pd.to_datetime(total["grant_date"])
    total["등록후일자"] = (total["last_modified_date"] - total["grant_date"]).dt.days
    total["log(등록후일자)"] = np.log1p(total["등록후일자"])

    total["권리자변동여부"] = total["rightholder_ch_cnt"].apply(lambda x: 1 if x >= 1 else 0)
    total["연차수_x2"] = total["연차수"] ** 2
    total["연차수_x3"] = total["연차수"] ** 3

    for ipc in ["B", "C", "D", "E", "F", "G", "H"]:
        total[f"IPC_{ipc}"] = total["main_ipc"].apply(lambda x: 1 if str(x).startswith(ipc) else 0)

    return total


# ===============================
# 3) predict_final_citation_with_details
# ===============================
def predict_final_citation_with_details(total, full_model, start_year, end_year=10):
    """
    10년 이하의 특허 피인용수 예측(누적) + 연도별 상세 정보 반환
    
    Returns:
        tuple: (final_cumulative, yearly_predictions)
    """
    try:
        cumulative_cit = float(total["f_cit_cnt"].values[0])
        val = total["등록후일자"].values[0]
        if pd.isna(val):
            original_days = 1
        else:
            original_days = int(val)

        input_vars = [
            "연차수", "연차수_x2", "연차수_x3",
            "log(누적피인용수)", "log(등록후일수)", "권리자변동여부", 
            "IPC_B", "IPC_C", "IPC_D", "IPC_E", "IPC_F", "IPC_G", "IPC_H",
            "연차수:IPC_B", "연차수:IPC_C", "연차수:IPC_D", "연차수:IPC_E",
            "연차수:IPC_F", "연차수:IPC_G", "연차수:IPC_H"
        ]

        yearly_predictions = []

        for y in range(int(start_year) + 1, int(end_year) + 1):
            row = total.copy()
            row["연차수"] = y
            row["연차수_x2"] = y ** 2
            row["연차수_x3"] = y ** 3

            remaining_days = original_days + (y - int(start_year)) * 365
            row["log(등록후일수)"] = np.log1p(remaining_days)

            for ipc in ["B", "C", "D", "E", "F", "G", "H"]:
                ipc_col = f"IPC_{ipc}"
                row[f"연차수:{ipc_col}"] = y * row[ipc_col]

            x_pred = sm.add_constant(pd.DataFrame(row[input_vars]), has_constant="add")
            y_pred = float(full_model.predict(x_pred).iloc[0])
            cumulative_cit += y_pred
            
            yearly_predictions.append({
                "year": int(y),
                "predicted_citation": round(float(y_pred), 2),
                "cumulative_citation": round(float(cumulative_cit), 2)
            })
            
    except Exception as e:
        print(f"ERROR predict_final_citation_with_details: {str(e)}")
        return float("nan"), []

    return float(cumulative_cit), yearly_predictions


# ===============================
# 4) estimate_10yr_from_now_with_details
# ===============================
def estimate_10yr_from_now_with_details(total, model):
    """
    10년 이상 특허의 10년차 예측 + 연도별 상세 정보 반환
    
    알고리즘:
    현재 연차부터 역방향으로 예측값을 빼면서 10년차까지 계산
    14년차(10) → 13년차 → 12년차 → 11년차 → 10년차(6)
    
    Returns:
        tuple: (estimated_10yr, yearly_predictions)
    """
    formula_vars = [
        "연차수", "연차수_x2", "연차수_x3",
        "log(누적피인용수)", "log(등록후일수)", "권리자변동여부",
        "IPC_B", "IPC_C", "IPC_D", "IPC_E", "IPC_F", "IPC_G", "IPC_H",
        "연차수:IPC_B", "연차수:IPC_C", "연차수:IPC_D", "연차수:IPC_E",
        "연차수:IPC_F", "연차수:IPC_G", "연차수:IPC_H"
    ]
    try:
        row = total.iloc[0].copy()
        curr_year = int(row["연차수"])
        curr_cit = float(row["f_cit_cnt"])
        actual_cit = float(curr_cit / curr_year) if curr_year > 0 else 0.0

        # 역방향으로 예측하면서 연도별 정보 저장
        cumulative_backward = curr_cit - actual_cit
        yearly_predictions = []
        
        # 현재 연차 추가 (실제 데이터)
        yearly_predictions.append({
            "year": int(curr_year),
            "predicted_citation": None,
            "cumulative_citation": int(curr_cit),
            "is_actual": True
        })
        
        # 역방향 예측: 현재-1년차 → 10년차까지
        for year in range(curr_year - 1, 9, -1):
            row_temp = row.copy()
            row_temp["연차수"] = year
            row_temp["연차수_x2"] = year ** 2
            row_temp["연차수_x3"] = year ** 3
            row_temp["log(누적피인용수)"] = np.log1p(cumulative_backward)

            remaining_days = max(int(row["등록후일자"]) - (curr_year - year) * 365, 0)
            row_temp["log(등록후일수)"] = np.log1p(remaining_days)

            for ipc in ["B", "C", "D", "E", "F", "G", "H"]:
                ipc_col = f"IPC_{ipc}"
                row_temp[f"연차수:IPC_{ipc}"] = year * row_temp.get(ipc_col, 0)

            predict_df = pd.DataFrame([{var: row_temp.get(var, 0) for var in formula_vars}])
            y_pred = float(model.predict(predict_df).iloc[0])
            cumulative_backward -= y_pred
            
            yearly_predictions.append({
                "year": int(year),
                "predicted_citation": round(float(y_pred), 2),
                "cumulative_citation": round(float(cumulative_backward), 2),
                "is_actual": False
            })
        
        estimated_10yr = cumulative_backward
        
        # 리스트를 역순으로 (10년차가 먼저 오도록)
        yearly_predictions.reverse()

        return float(estimated_10yr), yearly_predictions
        
    except Exception as e:
        print(f"estimate_10yr_from_now_with_details 에러: {e}")
        import traceback
        traceback.print_exc()
        return float("nan"), []


# ===============================
# 5) map_to_stanine_zscore
# ===============================
def map_to_stanine_zscore(new_value, thresholds, log_mean, log_std):
    log_val = np.log1p(new_value)
    z_val = (log_val - log_mean) / log_std
    stanine = np.digitize(z_val, bins=thresholds, right=True) + 1
    return int(stanine)


# ===============================
# 6) 서비스 진입점: citation_predict
# ===============================
def citation_predict(session: Session, app_number: str):
    """
    Flask의 /citpredict 엔드포인트 로직을 서비스 함수로 이식.
    연도별 예측 정보도 함께 반환
    """
    try:
        # thresholds 로드
        with open(THRESHOLDS_PATH, "r") as f:
            data = json.load(f)
            thresholds = np.array(data["thresholds"])
            log_mean = float(data["mean"])
            log_std = float(data["std"])

        # 데이터 조회
        techdna, biblio = fetch_techdna_and_biblio(app_number, session)
        
        if not techdna:
            print("techdna 데이터가 없습니다")
            return None
        
        if not biblio or biblio.get("grant_date") is None:
            print("biblio의 날짜 데이터가 없습니다")
            # return result


        # 입력 전처리
        total = preprocess_inputs(techdna, biblio)
        
        # 모델 로드
        full_model = joblib.load(MODEL_PATH)

        # 연차
        year = int(total["연차수"].values[0])
        current_citation = int(total["f_cit_cnt"].values[0])

        yearly_predictions = []
        
        if year > 10:
            # 10년 이상: 역산 후 정방향 재구성 (1~10년차)
            final_10year, yearly_preds = estimate_10yr_from_now_with_details(total, full_model)
            yearly_predictions = yearly_preds
        else:
            # 10년 이하: 순방향 예측
            final_10year, yearly_preds = predict_final_citation_with_details(total, full_model, start_year=year)
            
            # 현재 연차까지의 실제 데이터 추가
            yearly_predictions.append({
                "year": int(year),
                "predicted_citation": None,
                "cumulative_citation": current_citation,
                "is_actual": True
            })
            
            # 예측 데이터 추가
            for pred in yearly_preds:
                pred["is_actual"] = False
                yearly_predictions.append(pred)
        
        final_10year = round(final_10year, 2)
        stanine = map_to_stanine_zscore(final_10year, thresholds, log_mean, log_std)
        
        result = {
            "출원번호": str(app_number),
            "연차수": int(year),
            "현재_누적_피인용수": current_citation,
            "10년차_누적_피인용수": float(final_10year),
            "스테나인_누적_피인용수": int(stanine),
            "연도별_예측": yearly_predictions
        }
        
        return result
        
    except Exception as e:
        print(f"[citation_predict] 에러 발생: {str(e)}")
        import traceback
        traceback.print_exc()
        return None