import os
import json
import numpy as np
import pandas as pd
from pickle import load
from pathlib import Path
from sqlalchemy.orm import Session
import warnings
warnings.filterwarnings("ignore")

# 🔹 SQLAlchemy 모델 임포트
from app.models.patent_model import PatentResult, PatentLiti, PatentInfo


# =====================================
# 🔹 경로 설정 (환경 변수 + Pathlib)
# =====================================
SERVICE_DIR = Path(__file__).parent
MODEL_DIR = SERVICE_DIR / "model"
SCALER_DIR = SERVICE_DIR / "stdSc"

MODEL_PATH = Path(os.getenv("NPE_MODEL_PATH", MODEL_DIR / "npe_predict_model"))
SCALER_PATH = Path(os.getenv("NPE_SCALER_PATH", SCALER_DIR / "standard_scaler.pkl"))

# =====================================
# 🔹 출원번호로 등록번호 + 권리자 정보 조회
# =====================================
def fetch_reginfo_by_appnum(app_number: str, conn: Session) -> pd.DataFrame:
    """
    출원번호(application_number)로 등록번호(reg_number)와
    권리자 정보를 PATENT_RESULT_TB / PATENT_INFO_TB에서 조회.
    """
    try:
        # 1️⃣ 출원번호로 등록번호(reg_number) 조회
        reg_number = (
            conn.query(PatentResult.reg_number)
            .filter(PatentResult.application_number == app_number)
            .scalar()
        )

        if not reg_number:
            print(f"[fetch_reginfo_by_appnum] 등록번호 없음: {app_number}")
            return pd.DataFrame()

        # 2️⃣ 등록번호로 권리자 정보 조회
        rows = (
            conn.query(
                PatentInfo.reg_number,
                PatentInfo.rgt_trnsf_seq,
                PatentInfo.rgtr_seq,
                PatentInfo.rgtr_cd,
                PatentInfo.rgtr_nm,
                PatentInfo.rgtr_addr,
            )
            .filter(PatentInfo.reg_number == reg_number)
            .all()
        )

        if not rows:
            print(f"[fetch_reginfo_by_appnum] 권리자 정보 없음: {reg_number}")
            return pd.DataFrame()

        # 3️⃣ 결과를 DataFrame으로 변환
        data = [
            {
                "reg_number": r.reg_number,
                "rgt_trnsf_seq": r.rgt_trnsf_seq,
                "rgtr_seq": r.rgtr_seq,
                "rgtr_cd": r.rgtr_cd,
                "rgtr_nm": r.rgtr_nm,
                "rgtr_addr": r.rgtr_addr,
            }
            for r in rows
        ]

        return pd.DataFrame(data)

    except Exception as e:
        print(f"[fetch_reginfo_by_appnum] DB 조회 오류: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


# =====================================
# 🔹 출원인 코드 리스트로 LITI 데이터 조회
# =====================================
def fetch_liti_by_codes(find_list: list[int], conn: Session):
    """출원인 코드(applicant_code) 리스트로 PATENT_LITI_TB 데이터 조회"""
    if not find_list:
        return pd.DataFrame()

    try:
        rows = (
            conn.query(
                PatentLiti.applicant_code,
                PatentLiti.name,
                PatentLiti.transfer_cnt,
                PatentLiti.apply_cnt,
                PatentLiti.defendant,
                PatentLiti.plaintiff,
            )
            .filter(PatentLiti.applicant_code.in_(find_list))
            .all()
        )

        if not rows:
            return pd.DataFrame()

        data = [
            {
                "applicant_code": r.applicant_code,
                "name": r.name,
                "transfer_cnt": r.transfer_cnt,
                "apply_cnt": r.apply_cnt,
                "defendant": r.defendant,
                "plaintiff": r.plaintiff,
            }
            for r in rows
        ]

        return pd.DataFrame(data)

    except Exception as e:
        print(f"[fetch_liti_by_codes] DB 조회 오류: {e}")
        return pd.DataFrame()


# =====================================
# 🔹 모델 및 스케일러 로드
# =====================================
def get_model():
    """
    NPE 예측 모델 및 스케일러 로드
    (환경변수 기반 경로 지원)
    """
    try:
        model = load(open(MODEL_PATH, "rb"))
        scaler = load(open(SCALER_PATH, "rb"))
        return model, scaler
    except Exception as e:
        print(f"[get_model] 모델 로드 오류: {e}")
        raise


# =====================================
# 🔹 NPE 확률 계산 메인 서비스
# =====================================
def get_appNumber_service(app_number: str, conn: Session):
    """
    출원번호 기반 NPE 확률 계산 (SQLAlchemy 세션 기반)
    """
    try:
        search_df = fetch_reginfo_by_appnum(app_number, conn)
        model, scaler = get_model()

        if search_df is None or search_df.empty:
            return [], 400

        # 🔹 최신 권리자 코드 리스트 추출
        con = search_df["rgt_trnsf_seq"] == search_df["rgt_trnsf_seq"].max()
        find_list = list(filter(None, search_df.loc[con, "rgtr_cd"].values))

        if not find_list:
            search_df["npe_prob"] = 0
            total = search_df
        else:
            find_list = list(map(int, find_list))
            X_data = fetch_liti_by_codes(find_list, conn)

            if X_data.empty:
                search_df["npe_prob"] = 0
                total = search_df
            else:
                # 🔹 모델 예측
                X_data = X_data.rename(columns={"transfer_cnt": "권리자변동이력", "apply_cnt": "출원수"})
                feature = scaler.transform(X_data[["권리자변동이력", "출원수", "defendant", "plaintiff"]])
                predict_prob = model.predict_proba(feature)[:, 1]

                # 🔹 예측 결과 병합
                X_data["npe_prob"] = predict_prob
                X_data.rename(columns={"applicant_code": "rgtr_cd"}, inplace=True)
                X_data["rgtr_cd"] = X_data["rgtr_cd"].astype(str)

                total = pd.merge(search_df, X_data[["rgtr_cd", "npe_prob"]], on="rgtr_cd", how="left")
                total["npe_prob"].fillna(0, inplace=True)

        total = total.where(pd.notna(total), None)
        return total.to_dict(orient="records"), 200

    except Exception as e:
        print(f"[get_appNumber_service] 에러: {e}")
        import traceback
        traceback.print_exc()
        return [], 500
