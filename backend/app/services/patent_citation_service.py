import os
import json
import joblib
import numpy as np
import pandas as pd
import statsmodels.api as sm
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from pathlib import Path

# ★ SQLAlchemy 모델 임포트 (프로젝트 실제 경로에 맞추세요)
from app.models.techdna_input import TechdnaIpforce  # STANINE_TECHDNA
from app.models.patent_model import PatentData  # PATENT_DATA_TB

# ======== 상수 정의 =========
IPC_CODES = ["B", "C", "D", "E", "F", "G", "H"]
FEATURE_COLUMNS = [
    "연차수", "연차수_x2", "연차수_x3",
    "log(누적피인용수)", "log(등록후일수)",
    "권리자변동여부",
    *[f"IPC_{ipc}" for ipc in IPC_CODES],
    *[f"연차수:IPC_{ipc}" for ipc in IPC_CODES]
]

# ===== 환경 변수 (경로 커스터마이징) =====
SERVICE_DIR = Path(__file__).parent
DATA_DIR = SERVICE_DIR / "data"
MODEL_DIR = SERVICE_DIR / "model"
SCALER_DIR = SERVICE_DIR / "stdSc"
MODEL_PATH = os.getenv("CITPRED_MODEL_PATH", MODEL_DIR / "poisson_model(251002).joblib")
THRESHOLDS_PATH = os.getenv("CITPRED_THRESHOLDS_PATH", DATA_DIR / "stanine_thresholds_zscore.json")


# ==============================================
# 유틸리티 함수
# ==============================================
def _to_datetime(v):
    if v is None:
        return None
    if isinstance(v, datetime):
        return v
    
    s = str(v)
    if len(s) == 8 and s.isdigit():
        try:
            return datetime.strptime(s, "%Y%m%d")  # ✅ 수정: strftime → strptime
        except ValueError:
            pass
    try:
        return pd.to_datetime(s)
    except Exception:
        return None

    
def add_polynomial_features(df, year):
    """연차수 다항 특성 추가"""
    df["연차수"] = year
    df["연차수_x2"] = year ** 2
    df["연차수_x3"] = year ** 3
    return df


def add_interaction_features(df, year):
    """IPC 코드와 연차수 교호작용 변수 추가"""
    for ipc in IPC_CODES:
        ipc_col = f"IPC_{ipc}"
        df[f"연차수:{ipc_col}"] = year * df.get(ipc_col, 0)
    return df


def create_ipc_dummies(df):
    """IPC 코드 원-핫 인코딩"""
    for ipc in IPC_CODES:
        df[f"IPC_{ipc}"] = df["main_ipc"].apply(
            lambda x: 1 if str(x).startswith(ipc) else 0
        )
    return df


# =====================================
# 1) 데이터 조회
# =====================================
def fetch_techdna_and_biblio(app_number: str, conn: Session):
    """
    SQLAlchemy 세션을 통해 특허 데이터 조회
    Args:
        app_number: 출원번호
        conn: SQLAlchemy 세션
    Returns:
        tuple: (techdna_dict, biblio_dict) 또는 (None, None)
    """
    try:
        # techdna 조회
        techdna_row = (
            conn.query(TechdnaIpforce)
            .filter(TechdnaIpforce.application_number == app_number)
            .order_by(TechdnaIpforce.application_number.desc())
            .first()
        )
        
        if not techdna_row:
            return None, None

        # biblio 조회
        biblio_row = (
            conn.query(PatentData)
            .filter(PatentData.application_number == app_number)
            .first()
        )

        # dict 형태로 변환
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

    except SQLAlchemyError as e:
        print(f"[fetch_techdna_and_biblio] DB 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None
    except Exception as e:
        print(f"[fetch_techdna_and_biblio] 예상치 못한 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        return None, None


# ===============================================
# 2) 데이터 전처리
# ===============================================
def preprocess_inputs(techdna, biblio):
    """
    입력 데이터 전처리 및 피처 엔지니어링
    Args:
        techdna: TechDNA 데이터 dict
        biblio: 서지정보 데이터 dict
    Returns:
        DataFrame: 전처리된 데이터
    """
    techdna_df = pd.DataFrame([techdna])
    biblio_df = pd.DataFrame([biblio])
    
    # 데이터 병합
    total = pd.merge(techdna_df, biblio_df, on="application_number")
    
    # 기본 변수 생성
    total["연차수"] = total["after_regi_year"]
    total["log(누적피인용수)"] = np.log1p(total["f_cit_cnt"])
    
    # 날짜 변환
    total["last_modified_date"] = pd.to_datetime(total['last_modified_date'])
    total["grant_date"] = pd.to_datetime(total["grant_date"])
    
    # 등록 후 일자 계산
    total["등록후일자"] = (
        total["last_modified_date"] - total["grant_date"]
    ).dt.days
    total["log(등록후일수)"] = np.log1p(total["등록후일자"])
    
    # 권리자 변동 여부
    total["권리자변동여부"] = total["rightholder_ch_cnt"].apply(
        lambda x: 1 if x >= 1 else 0
    )
    
    # 다항 특성
    total["연차수_x2"] = total["연차수"] ** 2
    total["연차수_x3"] = total["연차수"] ** 3
    
    # IPC 더미 변수
    total = create_ipc_dummies(total)
    
    # IPC 교호작용 변수
    year = total["연차수"].values[0]
    total = add_interaction_features(total, year)
    return total


# ===================================
# 3) 10년 이하 특허 예측 (순방향)
# ===================================
def predict_final_citation_with_details(total, full_model, start_year, end_year=10):
    """
    10년 이하 특허의 미래 피인용수 예측 (순방향)
    Args:
        total: 전처리된 데이터프레임
        full_model: 학습된 Poisson 모델
        start_year: 현재 연차
        end_year: 예측 종료 연차 (기본값: 10)
    Returns:
        tuple: (최종 누적 피인용수, 연도별 예측 리스트)
    """
    try:
        # 현재 누적 피인용수
        cumulative_cit = float(total["f_cit_cnt"].values[0])
        
        # 등록 후 일자
        val = total["등록후일자"].values[0]
        original_days = 1 if pd.isna(val) else int(val)
        
        yearly_predictions = []
        
        # 현재 연차부터 10년차까지 순방향 예측
        for y in range(int(start_year) + 1, int(end_year) + 1):
            row = total.copy()
            
            # 다항 특성 업데이트
            row = add_polynomial_features(row, y)
            
            # 등록 후 일수 계산
            remaining_days = original_days + (y - int(start_year)) * 365
            row["log(등록후일수)"] = np.log1p(remaining_days)
            
            # 누적 피인용수 업데이트
            row["log(누적피인용수)"] = np.log1p(cumulative_cit)
            
            # IPC 교호작용 업데이트
            row = add_interaction_features(row, y)
            
            # 예측
            x_pred = sm.add_constant(
                pd.DataFrame(row[FEATURE_COLUMNS]),
                has_constant="add"
            )
            y_pred = float(full_model.predict(x_pred).iloc[0])
            
            # 누적
            cumulative_cit += y_pred
            
            yearly_predictions.append({
                "year": y,
                "predicted_citation": round(y_pred, 2),
                "cumulative_citation": round(cumulative_cit, 2)
            })
        
        return cumulative_cit, yearly_predictions
        
    except Exception as e:
        print(f"[predict_final_citation_with_details] 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        return float("nan"), []


# =======================================
# 4) 10년 이상 특허 예측 (역방향)
# =======================================
def estimate_10yr_from_now_with_details(total, model):
    """
    10년 이상 특허의 10년차 시점 피인용수 추정 (역방향)
    Args:
        total: 전처리된 데이터프레임
        model: 학습된 Poisson 모델
        
    Returns:
        tuple: (10년차 누적 피인용수, 연도별 예측 리스트)
    """
    try:
        row = total.iloc[0].copy()
        curr_year = int(row["연차수"])
        cumulative_backward = float(row["f_cit_cnt"])
        original_days = int(row["등록후일자"])
        
        yearly_predictions = []
        
        # 역방향 예측: 현재 연차 → 10년차
        for year in range(curr_year, 9, -1):  # ✅ 수정: 9 -1 → 9, -1
            row_temp = row.copy()
            
            # 다항 특성 업데이트
            row_temp = add_polynomial_features(row_temp, year)
            
            # 누적 피인용수
            row_temp["log(누적피인용수)"] = np.log1p(cumulative_backward)
            
            # 등록 후 일수 계산 (역방향)
            days_diff = (curr_year - year) * 365
            remaining_days = max(original_days - days_diff, 0)
            row_temp["log(등록후일수)"] = np.log1p(remaining_days)
            
            # IPC 교호작용
            row_temp = add_interaction_features(row_temp, year)
            
            # 현재 연차는 실제값 기록
            if year == curr_year:
                yearly_predictions.append({
                    "year": year,
                    "predicted_citation": None,
                    "cumulative_citation": round(cumulative_backward, 2),  # ✅ 수정: 콤마 추가
                    "is_actual": True
                })
            else:
                # 예측 수행
                predict_df = pd.DataFrame([{
                    var: row_temp.get(var, 0) for var in FEATURE_COLUMNS
                }])
                
                # statsmodels 모델용 상수항 추가
                x_pred = sm.add_constant(predict_df, has_constant="add")
                y_pred = float(model.predict(x_pred).iloc[0])
                
                # 역방향 누적 (빼기)
                cumulative_backward -= y_pred
                
                yearly_predictions.append({
                    "year": year,
                    "predicted_citation": round(y_pred, 2),
                    "cumulative_citation": round(cumulative_backward, 2),
                    "is_actual": False
                })
        
        # 리스트 역순 정렬 (10년차가 먼저 오도록)
        yearly_predictions.reverse()
        
        return cumulative_backward, yearly_predictions
        
    except Exception as e:
        print(f"[estimate_10yr_from_now_with_details] 에러: {e}")
        import traceback
        traceback.print_exc()
        return float("nan"), []


# ==========================================
# 5) Stanine 등급 매핑
# ==========================================
def map_to_stanine_zscore(new_value, thresholds, log_mean, log_std):  # ✅ 수정: statnine → stanine
    """
    예측값을 Stanine 등급(1~9)으로 변환
    Args:
        new_value: 예측된 피인용수
        thresholds: Z-score 기준 임계값 배열
        log_mean: 로그 변환 평균
        log_std: 로그 변환 표준편차
        
    Returns:
        int: Stanine 등급 (1~9)
    """
    log_val = np.log1p(new_value)
    z_val = (log_val - log_mean) / log_std
    stanine = np.digitize(z_val, bins=thresholds, right=True) + 1
    return int(stanine)

# ==========================================
# 6) 메인 서비스 함수
# ==========================================
def citation_predict(session: Session, app_number: str):
    """
    특허 피인용수 예측 메인 함수
    Args:
        session: SQLAlchemy 세션
        app_number: 출원번호
    """
    try:
        # 1. Stanine 임계값 로드
        try:
            with open(THRESHOLDS_PATH, "r") as f:
                data = json.load(f)
                thresholds = np.array(data["thresholds"])
                log_mean = float(data["mean"])
                log_std = float(data["std"])
        except FileNotFoundError:
            return {
                "success": False,
                "error": {
                    "code": "FILE_NOT_FOUND",
                    "message": "Stanine 임계값 파일을 찾을 수 없습니다."
                }
            }
        
        # 2. 데이터 조회
        techdna, biblio = fetch_techdna_and_biblio(app_number, session)  # ✅ 수정: 함수명
        
        if not techdna:
            return {
                "success": False,
                "error": {
                    "code": "TECHDNA_NOT_FOUND",  # ✅ 수정: TECHDAN → TECHDNA
                    "message": f"출원번호 {app_number}에 해당하는 TechDNA 데이터를 찾을 수 없습니다."
                }
            }
        
        if not biblio or biblio.get("grant_date") is None:
            return {
                "success": False,
                "error": {
                    "code": "BIBLIO_DATA_MISSING",
                    "message": f"출원번호 {app_number}의 서지정보 또는 등록일 데이터가 없습니다."
                }
            }
        
        # 3. 데이터 전처리
        total = preprocess_inputs(techdna, biblio)
        
        # 4. 모델 로드
        try:
            full_model = joblib.load(MODEL_PATH)
        except FileNotFoundError:
            return {
                "success": False,
                "error": {
                    "code": "MODEL_NOT_FOUND",
                    "message": "예측 모델 파일을 찾을 수 없습니다."
                }
            }
            

        # 5. 기본 정보 추출
        year = int(total["연차수"].values[0])
        current_citation = int(total["f_cit_cnt"].values[0])
        
        # 6. 연차에 따라 예측 방식 선택
        yearly_predictions = []  # ✅ 수정: yealy → yearly
        
        if year > 10:
            # 10년 이상: 역방향 예측
            final_10year, yearly_preds = estimate_10yr_from_now_with_details(
                total, full_model
            )
            yearly_predictions = yearly_preds
            
        else:
            # 10년 이하: 순방향 예측
            final_10year, yearly_preds = predict_final_citation_with_details(
                total, full_model, start_year=year
            )
            
            # 현재 연차 실제 데이터 추가
            yearly_predictions.append({
                "year": year,
                "predicted_citation": None,
                "cumulative_citation": current_citation,
                "is_actual": True
            })
            
            # 미래 예측 데이터 추가
            for pred in yearly_preds:
                pred["is_actual"] = False
                yearly_predictions.append(pred)
                
        # 7. 예측 실패 체크
        if np.isnan(final_10year):
            return {
                "success": False,  # ✅ 수정: sucess → success
                "error": {
                    "code": "PREDICTION_FAILED",
                    "message": "피인용수 예측 중 오류가 발생했습니다."
                }
            }
            
        # 8. Stanine 등급 계산
        final_10year = max(0.0, round(final_10year, 2))
        # 연도별 상세 데이터 내의 음수 보정
        for pred in yearly_predictions:
            if pred.get("predicted_citation") is not None:
                pred["predicted_citation"] = max(0.0, round(pred["predicted_citation"], 2))
            if pred.get("cumulative_citation") is not None:
                pred["cumulative_citation"] = max(0.0, round(pred["cumulative_citation"], 2))
        
        stanine = map_to_stanine_zscore(
            final_10year, thresholds, log_mean, log_std
        )
        
        # 9. 성공 응답 반환
        return {
            "success": True,
            "data": {
                "출원번호": str(app_number),
                "연차수": year,
                "현재_누적_피인용수": current_citation,
                "10년차_누적_피인용수": final_10year,
                "스테나인_누적_피인용수": stanine,
                "연도별_예측": yearly_predictions  # ✅ 수정: yealy → yearly
            }
        }
        
    except Exception as e:
        print(f"[citation_predict] 예상치 못한 에러: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "서버 내부 오류가 발생했습니다.",
                "detail": str(e)
            }
        }