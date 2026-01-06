import os
import json
import joblib
import numpy as np
import pandas as pd
import statsmodels.api as sm
from datetime import datetime
from sqlalchemy.orm import Session

# ★ SQLAlchemy 모델 임포트 (프로젝트 실제 경로에 맞추세요)
from app.models.stanine_techdna import StanineTechdna  # STANINE_TECHDNA
from app.models.techdna_input import TechdnaIpforce  # STANINE_TECHDNA
from app.models.patent_model import PatentData        # PATENT_DATA_TB

# ===== 환경 변수 (경로 커스터마이징) =====
MODEL_PATH = os.getenv("CITPRED_MODEL_PATH", "/app/app/services/model/poisson_model(251002).joblib")
THRESHOLDS_PATH = os.getenv("CITPRED_THRESHOLDS_PATH", "/app/app/services/data/stanine_thresholds_zscore.json")


# ===============================
# 1) fetch_techdna_and_biblio  ← 함수명 유지
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
    except Exception as e:
        print(str(e))
    return techdna, biblio


def _to_datetime(v):
    if v is None:
        return None
    # DB가 'YYYYMMDD' 문자열을 줄 수도, datetime을 줄 수도 있음
    if isinstance(v, (datetime, )):
        return v
    s = str(v)
    # YYYYMMDD → datetime
    if len(s) == 8 and s.isdigit():
        return datetime.strptime(s, "%Y%m%d")
    # 기타 포맷은 pandas에 맡김
    try:
        return pd.to_datetime(s)
    except Exception:
        return None


# ===============================
# 2) preprocess_inputs  ← 함수명 유지
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
# 3) predict_final_citation  ← 함수명 유지
# ===============================
def predict_final_citation(total, full_model, start_year, end_year=10):
    """
    10년 이하의 특허 피인용수 예측(누적). 원본 로직 최대한 유지.
    """
    # 251016
    try:
        cumulative_cit = float(total["f_cit_cnt"].values[0])
        # original_days = int(total["등록후일자"].values[0])
        # original_days = int(total["등록후일자"].fillna(0).values[0])
        val = total["등록후일자"].values[0]
        if pd.isna(val):
            original_days = 1  # 0 대신 1로 (log1p 계산 안정)
        else:
            original_days = int(val)

        input_vars = [
            "연차수", "연차수_x2", "연차수_x3",
            "log(누적피인용수)", "log(등록후일수)", "권리자변동여부",
            "IPC_B", "IPC_C", "IPC_D", "IPC_E", "IPC_F", "IPC_G", "IPC_H",
            "연차수:IPC_B", "연차수:IPC_C", "연차수:IPC_D", "연차수:IPC_E",
            "연차수:IPC_F", "연차수:IPC_G", "연차수:IPC_H"
        ]

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
            
    except Exception as e:
        print(f"ERROR predict_final_citation: {str(e)}")

    return float(cumulative_cit)


# ===============================
# 4) estimate_10yr_from_now  ← 함수명 유지
# ===============================
def estimate_10yr_from_now(total, model):
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

        cumulative = curr_cit - actual_cit

        for year in range(curr_year - 1, 9, -1):
            row_temp = row.copy()
            row_temp["연차수"] = year
            row_temp["연차수_x2"] = year ** 2
            row_temp["연차수_x3"] = year ** 3
            row_temp["log(누적피인용수)"] = np.log1p(cumulative)

            remaining_days = max(int(row["등록후일자"]) - (curr_year - year) * 365, 0)
            row_temp["log(등록후일수)"] = np.log1p(remaining_days)

            for ipc in ["B", "C", "D", "E", "F", "G", "H"]:
                ipc_col = f"IPC_{ipc}"
                row_temp[f"연차수:IPC_{ipc}"] = year * row_temp.get(ipc_col, 0)

            predict_df = pd.DataFrame([{var: row_temp.get(var, 0) for var in formula_vars}])
            y_pred = float(model.predict(predict_df).iloc[0])
            cumulative -= y_pred

        return float(cumulative)
    except Exception as e:
        print(f"estimate_10yr_from_now 에러: {e}")
        return float("nan")


# ===============================
# 5) map_to_stanine_zscore  ← 함수명 유지
# ===============================
def map_to_stanine_zscore(new_value, thresholds, log_mean, log_std):
    log_val = np.log1p(new_value)
    z_val = (log_val - log_mean) / log_std
    stanine = np.digitize(z_val, bins=thresholds, right=True) + 1
    return int(stanine)


# ===============================
# 6) 서비스 진입점: citation_predict (라우터가 호출)
# ===============================
def citation_predict(session: Session, app_number: str):
    """
    Flask의 /citpredict 엔드포인트 로직을 서비스 함수로 이식.
    - 모델/thresholds 파일 경로는 환경변수로 조정 가능
    """
    # thresholds 로드
    with open(THRESHOLDS_PATH, "r") as f:
        data = json.load(f)
        thresholds = np.array(data["thresholds"])
        log_mean = float(data["mean"])
        log_std = float(data["std"])

    # 데이터 조회
    techdna, biblio = fetch_techdna_and_biblio(app_number, session)
    if not techdna:
        return None
    if not biblio or biblio.get("grant_date") is None:
        return None
    
    # 입력 전처리
    total = preprocess_inputs(techdna, biblio)

    # 모델 로드
    full_model = joblib.load(MODEL_PATH)

    # 연차
    year = int(total["연차수"].values[0])

    if year > 10:
        final_10year = estimate_10yr_from_now(total, full_model)
    else:
        final_10year = round(predict_final_citation(total, full_model, start_year=year))
    
    stanine = map_to_stanine_zscore(final_10year, thresholds, log_mean, log_std)
    
    result = {
        "출원번호": str(app_number),
        "연차수": int(year),
        "현재 누적 피인용수": int(total["f_cit_cnt"].values[0]),
        "10년차 누적 피인용수": float(round(final_10year, 4)),
        "스테나인 누적 피인용수": int(stanine),
    }
    return result
