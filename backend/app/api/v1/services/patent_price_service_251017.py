from app.models.stanine_techdna import StanineTechdna
from sqlalchemy.orm import Session

import os, json, numpy as np, pandas as pd
from collections import OrderedDict
from sqlalchemy.orm import Session
from app.models.stanine_techdna import StanineTechdna
from app.models.stanine_bscore import StanineBscore
from app.schemas.patent_schema import StanineTechdnaSchema, StanineBscoreSchema
# from services.patent_price_service import PatentPriceModel  # 모델 로더

DEFAULT_PATH = os.getenv("PATENT_DEFAULT_PATH", "/app/app/services")
LEGAL = float(os.getenv("LEGAL", 71.0))
MARKET = float(os.getenv("MARKET", 12.05623075699263))
ECONOMY = float(os.getenv("ECONOMY", 32.0))
STRATEGY = float(os.getenv("STRATEGY", 44.0))
REAL_PRICE = os.getenv("REAL_PRICE", "Not found")

def eval_patent_price(session: Session, app_number: str):
    try:
        # --------------------------
        # 1️⃣ JSON 설정 로드
        # --------------------------
        with open(f"{DEFAULT_PATH}/data/model_column.json", "r", encoding="utf-8") as f:
            model_col = json.load(f)
        with open(f"{DEFAULT_PATH}/data/techdna_col_mapping.json", "r", encoding="utf-8") as f:
            techdna_col = json.load(f)
        print("m", model_col)
        print("t", techdna_col)
        # --------------------------
        # 2️⃣ StanineTechdna 조회
        # --------------------------
        techdna_objs = session.query(StanineTechdna).filter_by(application_number=app_number).all()
        if not techdna_objs:
            raise Exception(f"No data found for application number {app_number}")

        df_techdna = pd.DataFrame([
            StanineTechdnaSchema.model_validate(o).model_dump()
            for o in techdna_objs
        ])
        applicant_codes = df_techdna["applicant_code"].dropna().unique().tolist()

        # --------------------------
        # 3️⃣ StanineBscore 조회
        # --------------------------
        bscore_objs = (
            session.query(StanineBscore)
            .filter(StanineBscore.applicant_code.in_(applicant_codes))
            .all()
        )
        df_bscore = (
            pd.DataFrame([
                StanineBscoreSchema.model_validate(o).model_dump()
                for o in bscore_objs
            ])
            if bscore_objs
            else pd.DataFrame(columns=["applicant_code"])
        )

        # --------------------------
        # 4️⃣ 병합 및 컬럼 매핑
        # --------------------------
        df_merged = pd.merge(df_techdna, df_bscore, on="applicant_code", how="left")
        df_merged.rename(columns=techdna_col, inplace=True)

        # --------------------------
        # 5️⃣ 모델 계산
        # --------------------------
        legal, market, economy, strategy = LEGAL, MARKET, ECONOMY, STRATEGY
        tech, real_price = 0.0, REAL_PRICE

        # 251016
        # feature = df_merged[model_col["tech_reg1"]]
        # model, scaler = PatentPriceModel.load_model_and_scaler("tech_reg1")
        feature = df_merged[model_col["tech_reg5"]]
        model, scaler = PatentPriceModel.load_model_and_scaler("tech_reg5")
        processed = PatentPriceModel.preprocess_features(feature, scaler)
        pred_score = model.predict(processed)
        tech = np.exp(pred_score)[0]

        features = pd.DataFrame(
            [[tech, legal, market, economy, strategy]],
            columns=["tech", "legal", "market", "economy", "strategy"]
        )
        main_model = PatentPriceModel.get_main_model()
        predicted_score = main_model.predict(features * 0.1)[0]
        predicted_price = int(round(np.exp(predicted_score), -3))

        if "price" in df_merged.columns and not df_merged["price"].isna().all():
            real_price = df_merged["price"].dropna().iloc[0]

        # --------------------------
        # 6️⃣ 결과 반환
        # --------------------------
        return {
            "application_number": int(app_number),
            "tech": float(tech),
            "legal": float(legal),
            "market": float(market),
            "economy": float(economy),
            "strategy": float(strategy),
            "predicted_price": predicted_price,
            "real_price": str(real_price),
        }

    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))



from sqlalchemy.orm import Session
from app.models.stanine_techdna import StanineTechdna
from app.models.stanine_bscore import StanineBscore
from app.schemas.patent_schema import StanineTechdnaSchema, StanineBscoreSchema
from app.core.db import get_session

import pandas as pd
import numpy as np
import json, os
from collections import OrderedDict
from pickle import load
from sklearn.preprocessing import MinMaxScaler


LEGAL = 71.0
MARKET = 12.05623075699263
ECONOMY = 32.0
STRATEGY = 44.0
REAL_PRICE = "Not found"

DEFAULT_PATH = os.getenv("PATENT_DEFAULT_PATH", "/app/app/services")

# -------------------------------------------------
# 🔹 메인 서비스 클래스
# -------------------------------------------------
class PatentPriceService:
    @staticmethod
    def eval_patent_price(session: Session, app_number: str):
        """
        FastAPI 기반 특허 가격 예측 서비스
        """
        try:
            # -----------------------------
            # 1️⃣ 입력값 검증 및 로깅
            # -----------------------------
            if not app_number:
                raise ValueError("application number is required")
            print(f"[eval_patent_price] Start for {app_number}")

            # -----------------------------
            # 2️⃣ DB 조회 (StanineTechdna)
            # -----------------------------
            # techdna_objs = session.query(StanineTechdna).filter_by(application_number=app_number).all()
            # if not techdna_objs:
            #     return {"error": f"No data found for application number {app_number}"}
            # techdna_data = [StanineTechdnaSchema.model_validate(o).model_dump() for o in techdna_objs]
            # df_techdna = pd.DataFrame(techdna_data)

            techdna_objs = session.query(StanineTechdna).filter_by(application_number=app_number).all()
            if not techdna_objs:
                return {"error": f"No data found for application number dd {app_number}"}

            techdna_data = [
                StanineTechdnaSchema.model_validate(obj).model_dump()
                for obj in techdna_objs
            ]
            df_techdna = pd.DataFrame(techdna_data)

            # -----------------------------
            # 3️⃣ applicant_code 추출
            # -----------------------------
            applicant_codes = df_techdna["applicant_code"].dropna().unique().tolist()

            # -----------------------------
            # 4️⃣ Bscore 조회
            # -----------------------------
            # bscore_objs = (
            #     session.query(StanineBscore)
            #     .filter(StanineBscore.applicant_code.in_(applicant_codes))
            #     .all()
            # )
            # df_bscore = (
            #     pd.DataFrame([StanineBscoreSchema.model_validate(o).model_dump() for o in bscore_objs])
            #     if bscore_objs
            #     else pd.DataFrame(columns=["applicant_code"])
            # )
            bscore_objs = (
                session.query(StanineBscore)
                .filter(StanineBscore.applicant_code.in_(df_techdna["applicant_code"].dropna().unique().tolist()))
                .all()
            )
            bscore_data = [
                StanineBscoreSchema.model_validate(obj).model_dump()
                for obj in bscore_objs
            ]
            df_bscore = pd.DataFrame(bscore_data) if bscore_data else pd.DataFrame(columns=["applicant_code"])

            # -----------------------------
            # 5️⃣ 컬럼 매핑 로드
            # -----------------------------
            with open(f"{DEFAULT_PATH}/data/model_column.json", "r", encoding="utf-8") as f:
                model_col = json.load(f)
            with open(f"{DEFAULT_PATH}/data/techdna_col_mapping.json", "r", encoding="utf-8") as f:
                techdna_col = json.load(f)

            # -----------------------------
            # 6️⃣ 병합 및 전처리
            # -----------------------------
            df_merged = pd.merge(df_techdna, df_bscore, on="applicant_code", how="left")
            df_merged.rename(columns=techdna_col, inplace=True)

            legal, market, economy, strategy = LEGAL, MARKET, ECONOMY, STRATEGY
            tech, real_price = 0.0, REAL_PRICE

            # -----------------------------
            # 7️⃣ 기술 점수(tech) 예측
            # -----------------------------
            # 251016
            # feature = df_merged[model_col["tech_reg1"]]
            # model, scaler = PatentPriceModel.load_model_and_scaler("tech_reg1")
            feature = df_merged[model_col["tech_reg5"]]
            model, scaler = PatentPriceModel.load_model_and_scaler("tech_reg5")
            processed_features = PatentPriceModel.preprocess_features(feature, scaler)
            pred_score = model.predict(processed_features)
            tech = float(np.exp(pred_score)[0])

            # -----------------------------
            # 8️⃣ 가격 예측
            # -----------------------------
            features = pd.DataFrame(
                [[tech, legal, market, economy, strategy]],
                columns=["tech", "legal", "market", "economy", "strategy"],
            )
            main_model = PatentPriceModel.get_main_model()
            predicted_score = main_model.predict(features * 0.1)[0]
            predicted_price = int(round(np.exp(predicted_score), -3))

            if "price" in df_merged.columns and not df_merged["price"].isna().all():
                real_price = df_merged["price"].dropna().iloc[0]

            # -----------------------------
            # 9️⃣ 응답 데이터 구성
            # -----------------------------
            response_data = OrderedDict(
                [
                    ("application_number", app_number),
                    ("tech", tech),
                    ("legal", legal),
                    ("market", market),
                    ("economy", economy),
                    ("strategy", strategy),
                    ("predicted_price", predicted_price),
                    ("real_price", str(real_price)),
                ]
            )
            return response_data

        except Exception as e:
            print(f"[Error] eval_patent_price: {e}")
            return {"error": str(e)}


# -------------------------------------------------
# 🔹 모델 로딩 및 전처리 유틸
# -------------------------------------------------
class PatentPriceModel:
    @staticmethod
    def load_model_and_scaler(model_name: str):
        try:
            # # 251016
            # model_path = f"{DEFAULT_PATH}/model/stan_{model_name}"
            model_path = f"{DEFAULT_PATH}/model/model_{model_name}"
            scaler_path = f"{DEFAULT_PATH}/stdSc/stan_{model_name}_stdSc"
            model = load(open(model_path, "rb"))
            scaler = load(open(scaler_path, "rb"))
            return model, scaler
        except Exception as e:
            raise FileNotFoundError(f"Error loading model or scaler for {model_name}: {e}")

    @staticmethod
    def preprocess_features(features, scaler):
        log_features = features.apply(lambda x: np.log1p(x))
        scaled_features = scaler.transform(log_features)
        return scaled_features

    @staticmethod
    def get_main_model():
        model_path = f"{DEFAULT_PATH}/model/price_lr"
        with open(model_path, "rb") as f:
            return load(f)
