"""
특허 가격 예측 서비스
"""

import os
import json
import logging
import numpy as np
import pandas as pd
import pymysql
import joblib
import statsmodels.api as sm
from pickle import load
from collections import OrderedDict
from contextlib import contextmanager
from sqlalchemy import select
from sqlalchemy.orm import Session
from datetime import datetime
from app.core.db import SyncSessionLocal
from pathlib import Path

# ★ SQLAlchemy 모델 임포트 (프로젝트 실제 경로에 맞추세요)
from app.models.stanine_techdna import StanineTechdna  # STANINE_TECHDNA
from app.models.stanine_bscore import StanineBscore  # STANINE_BSCORE
from app.models.techdna_input import TechdnaIpforce  # TECHDNA_INPUT
from app.models.patent_model import PatentData        # PATENT_DATA_TB

logger = logging.getLogger(__name__)

# ========================================
# 환경 변수 설정
# ========================================
SERVICE_DIR = Path(__file__).parent
DATA_DIR = SERVICE_DIR / "data"
MODEL_DIR = SERVICE_DIR / "model"
SCALER_DIR = SERVICE_DIR / "stdSc"
# DEFAULT_PATH = os.getenv("PATENT_DEFAULT_PATH", "./")

# JSON 설정 로드
try:
    with open(DATA_DIR / "model_column.json", "r", encoding="utf-8") as f:
        MODEL_COL = json.load(f)
    with open(DATA_DIR / "techdna_col_mapping.json", "r", encoding="utf-8") as f:
        TECHDNA_COL = json.load(f)
    with open(DATA_DIR / "bscore_col_mapping.json", "r", encoding="utf-8") as f:
        BSCORE_COL = json.load(f)
except Exception as e:
    logger.error(f"JSON 설정 파일 로드 실패: {e}")
    MODEL_COL = {}
    TECHDNA_COL = {}


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

# ========================================
# 피인용수 관련 함수
# ========================================
def fetch_techdna_for_citation(app_number, conn: Session):
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
            # raw 피처 컬럼
            "family_country_count": techdna_row.family_country_count,
            "division_app": techdna_row.division_app,
            "early_disclosure": techdna_row.early_disclosure,
            "image_cnt": techdna_row.image_cnt,
            "inventor_cnt": techdna_row.inventor_cnt,
        }

        biblio = None
        if biblio_row:
            biblio = {
                "application_number": str(biblio_row.application_number),
                "grant_date": _to_datetime(biblio_row.grant_date),
            }
        return techdna, biblio

    except Exception as e:
        logger.exception(f"fetch_techdna_for_citation 오류({app_number}): {e}")
        return None, None


def preprocess_citation_inputs(techdna: dict, biblio: dict):
    """피인용수 예측 전처리"""
    total = pd.merge(pd.DataFrame([techdna]), pd.DataFrame([biblio]), on='application_number')
    
    total['연차수'] = total['after_regi_year']
    total['log(누적피인용수)'] = np.log1p(total['f_cit_cnt'])
    total['last_modified_date'] = pd.to_datetime(total['last_modified_date'])
    total['grant_date'] = pd.to_datetime(total['grant_date'])
    total['등록후일자'] = (total['last_modified_date'] - total['grant_date']).dt.days
    total['log(등록후일수)'] = np.log1p(total['등록후일자'])
    total['권리자변동여부'] = (total['rightholder_ch_cnt'] >= 1).astype(int)
    total['연차수_x2'] = total['연차수'] ** 2
    total['연차수_x3'] = total['연차수'] ** 3
    
    for ipc in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
        total[f'IPC_{ipc}'] = total['main_ipc'].apply(lambda x: 1 if str(x).startswith(ipc) else 0)
    return total


def load_citation_model_and_thresholds():
    """모델과 스테나인 변환 threshold 로드"""
    full_model = joblib.load(MODEL_DIR / "poisson_model(251002).joblib")
    with open(DATA_DIR / 'stanine_thresholds_zscore.json', 'r') as f:
        data = json.load(f)
    return full_model, np.array(data['thresholds']), data["mean"], data['std']


def predict_final_citation(total, full_model, start_year: int, end_year: int = 10):
    """10년 이하 특허의 피인용수 예측"""
    cumulative_cit = total['f_cit_cnt'].values[0]
    original_days = 0 if pd.isna(total['등록후일자'].values[0] ) else total['등록후일자'].values[0]
    
    input_vars = [
        '연차수', '연차수_x2', '연차수_x3', 'log(누적피인용수)', 'log(등록후일수)', '권리자변동여부',
        'IPC_B', 'IPC_C', 'IPC_D', 'IPC_E', 'IPC_F', 'IPC_G', 'IPC_H',
        '연차수:IPC_B', '연차수:IPC_C', '연차수:IPC_D', '연차수:IPC_E',
        '연차수:IPC_F', '연차수:IPC_G', '연차수:IPC_H'
    ]
    
    for y in range(start_year + 1, end_year + 1):
        row = total.copy()
        row['연차수'] = y
        row['연차수_x2'] = y ** 2
        row['연차수_x3'] = y ** 3
        row['log(등록후일수)'] = np.log1p(original_days + (y - start_year) * 365)
        row['log(누적피인용수)'] = np.log1p(cumulative_cit)
        
        for ipc in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
            row[f'연차수:IPC_{ipc}'] = y * row[f'IPC_{ipc}']
        
        x_pred = sm.add_constant(pd.DataFrame(row[input_vars]), has_constant='add')
        cumulative_cit += float(full_model.predict(x_pred).iloc[0])
    
    return float(cumulative_cit)


def estimate_10yr_from_now(total, model):
    """10년 초과 특허의 10년차 피인용수 역추정"""
    formula_vars = [
        '연차수', '연차수_x2', '연차수_x3', 'log(누적피인용수)', 'log(등록후일수)', '권리자변동여부',
        'IPC_B', 'IPC_C', 'IPC_D', 'IPC_E', 'IPC_F', 'IPC_G', 'IPC_H',
        '연차수:IPC_B', '연차수:IPC_C', '연차수:IPC_D', '연차수:IPC_E',
        '연차수:IPC_F', '연차수:IPC_G', '연차수:IPC_H'
    ]
    
    try:
        row = total.iloc[0].copy()
        curr_year, curr_cit = int(row['연차수']), float(row['f_cit_cnt'])
        cumulative = curr_cit - (curr_cit / curr_year)
        
        for year in range(curr_year - 1, 9, -1):
            row_temp = row.copy()
            row_temp['연차수'] = year
            row_temp['연차수_x2'] = year ** 2
            row_temp['연차수_x3'] = year ** 3
            row_temp['log(누적피인용수)'] = np.log1p(cumulative)
            row_temp['log(등록후일수)'] = np.log1p(max(row['등록후일자'] - (curr_year - year) * 365, 0))
            
            for ipc in ['B', 'C', 'D', 'E', 'F', 'G', 'H']:
                row_temp[f'연차수:IPC_{ipc}'] = year * row_temp.get(f'IPC_{ipc}', 0)
            
            predict_df = pd.DataFrame([{var: row_temp.get(var, 0) for var in formula_vars}])
            cumulative -= float(model.predict(predict_df).iloc[0])
        
        return cumulative
    except Exception as e:
        logger.error(f"역추정 오류: {e}")
        return np.nan


def map_to_stanine_zscore(new_value, thresholds, log_mean, log_std):
    """10년차 피인용수를 스테나인으로 변환"""
    z_val = (np.log1p(new_value) - log_mean) / log_std
    return np.digitize(z_val, bins=thresholds, right=True) + 1


def calculate_tech_score(session: Session, app_number: str) -> tuple:
    """
    tech 점수(스테나인 × 10)와 tech_feature_data를 함께 반환합니다.

    Returns
    -------
    (tech_score: float, tech_feature_data: dict)

    tech_feature_data 구성
    ----------------------
    - 현재 누적 피인용수 : DB에서 조회한 f_cit_cnt 원본값
    - 예측 10년차 피인용수: Poisson 모델 예측값
    - 스테나인 등급       : 1~9 정수
    """
    DEFAULT_TECH = 34.54
    DEFAULT_FEATURE_DATA = {}

    try:
        full_model, thresholds, log_mean, log_std = load_citation_model_and_thresholds()
        techdna, biblio = fetch_techdna_for_citation(app_number, session)

        if not techdna or not biblio.get('grant_date'):
            if not techdna:
                logger.warning(f"[TECHDNA_INPUT] 데이터 없음 ({app_number}), Tech 기본값 사용")
            elif not biblio or not biblio.get('grant_date'):
                logger.warning(f"[PATENT_DATA_TB] grant_date 없음 ({app_number}), Tech 기본값 사용")
            return DEFAULT_TECH, DEFAULT_FEATURE_DATA

        total = preprocess_citation_inputs(techdna, biblio)
        year = total['연차수'].values[0]
        current_cit = float(total['f_cit_cnt'].values[0])

        if year > 10:
            final_10year = estimate_10yr_from_now(total, full_model)
        else:
            final_10year = predict_final_citation(total, full_model, start_year=year)

        stanine = map_to_stanine_zscore(final_10year, thresholds, log_mean, log_std)
        tech_score = float(stanine * 10.0)

        tech_feature_data = {
            "총 피인용수": int(techdna.get("f_cit_cnt") or 0),
            "권리자변동여부": int(techdna.get("rightholder_ch_cnt") or 0),
            "등록 경과 연차수": int(techdna.get("after_regi_year") or 0),
        }

        return tech_score, tech_feature_data

    except Exception as e:
        logger.error(f"Tech 점수 계산 오류 ({app_number}): {e}")
        return DEFAULT_TECH, DEFAULT_FEATURE_DATA


def get_real_price(app_number: str):
    """TECHDNA_INPUT 테이블에서 실제 거래 가격 조회"""
    try:
        with SyncSessionLocal() as session:  # 세션 시작
            record = (
                session.query(TechdnaIpforce.price)
                .filter(TechdnaIpforce.application_number == app_number)
                .first()
            )
            if record and record[0] is not None:
                return record[0]
            else:
                return "Not found"
    except Exception as e:
        logger.error(f"실제 가격 조회 오류: {e}")
        return "Not found"


# ========================================
# 모델 로딩 유틸리티
# ========================================
def load_model_and_scaler(model_name: str):
    """모델과 스케일러 로드"""
    try:
        model_path = MODEL_DIR / f'model_{model_name}'
        scaler_path = SCALER_DIR / f'stan_{model_name}_stdSc'
        model = load(open(model_path, 'rb'))
        scaler = load(open(scaler_path, 'rb'))
        return model, scaler
    except Exception as e:
        raise FileNotFoundError(f"모델 로딩 실패 ({model_name}): {e}")


def get_main_model():
    """가격 예측 메인 모델 로드"""
    try:
        model_path = MODEL_DIR / 'price_lr'
        with open(model_path, 'rb') as f:
            return load(f)
    except Exception as e:
        raise FileNotFoundError(f"메인 모델 로딩 실패: {e}")


def _safe_val(v):
    """None/NaN/inf 방어 — 숫자면 float, 문자열이면 str, None이면 None"""
    if v is None:
        return None
    if isinstance(v, str):
        return v
    try:
        f = float(v)
        return None if (pd.isna(f) or np.isinf(f)) else f
    except Exception:
        return None


def _extract_raw_feature_data(dim: str, raw_input: dict, df_bscore: pd.DataFrame) -> dict:
    """
    지표(dim)별로 raw 피처값을 추출합니다.

    raw_input: TECHDNA_INPUT에서 직접 조회한 dict
    - family_country_count : 해외 패밀리 수
    - division_app         : 분할출원 여부  (YES/NO)
    - early_disclosure     : 조기공개 여부  (YES/NO)
    - image_cnt            : 도면 수
    - inventor_cnt         : 발명자수

    df_bscore: STANINE_BSCORE DataFrame
    - real_cr_grd          : 신용등급 (문자열)
    """
    def techdna_val(col):
        return _safe_val(raw_input.get(col))

    def bscore_val(col):
        if df_bscore.empty:
            return None
        # NaN 아닌 첫 번째 row에서 추출
        matched = df_bscore[df_bscore[col].notna()]
        if matched.empty:
            return None
        return _safe_val(matched.iloc[0].get(col))

    if dim == 'legal':
        return {
            "해외 패밀리 국가수": techdna_val("family_country_count"),
            "등록 경과 연차 수":  techdna_val("after_regi_year"),
            "분할출원 여부":      techdna_val("division_app"),
        }
    elif dim == 'market':
        return {
            "해외 패밀리 국가수":  techdna_val("family_country_count"),
            "신용등급":           bscore_val("real_cr_grd"),
            "평균월급":           bscore_val("average_salary"),
        }
    elif dim == 'economy':
        return {
            "해외 패밀리 국가수":  techdna_val("family_country_count"),
            "조기공개 여부":       techdna_val("early_disclosure"),
            "도면 수(개)":         techdna_val("image_cnt"),
        }
    elif dim == 'strategy':
        return {
            "발명자수(명)":        techdna_val("inventor_cnt"),
            "공시지가":           bscore_val("land_price"),
            "평균월급":           bscore_val("average_salary"),
        }
    return {}


# ========================================
# 메인 서비스 함수
# ========================================
def eval_patent_price(session: Session, app_number: str) -> dict:
    """
    특허 가격 예측 메인 함수
    """
    try:
        logger.info(f"특허 가격 예측 시작: {app_number}")
        
        # 1️⃣ Tech 점수 계산 (별도 서버에서)
        tech_score, tech_feature_data = calculate_tech_score(session, app_number)
        
        # 2️⃣ StanineTechdna 조회
        techdna_objs = (
            session.query(StanineTechdna)
            .filter_by(application_number=app_number)
            .all()
        )
        
        if not techdna_objs:
            # 예외 대신 기본값으로 응답
            logger.warning(f"[STANINE_TECHDNA] 출원번호 {app_number} 데이터 없음 → 기본값 반환")
            default_pred = {
                "tech": tech_score,
                "legal": 71.0,
                'market': 12.06,
                'economy': 32.0,
                'strategy': 44.0
            }
            features = pd.DataFrame([default_pred])
            main_model = get_main_model()
            predicted_price = main_model.predict(features * 0.1)[0]
            real_price = get_real_price(app_number)

            return OrderedDict([
                ('application_number', app_number),
                ('tech', round(default_pred['tech'], 2)),
                ('tech_feature_data', tech_feature_data),
                ('legal', round(default_pred['legal'], 2)),
                ('legal_feature_data', {}),
                ('market', round(default_pred['market'], 2)),
                ('market_feature_data', {}),
                ('economy', round(default_pred['economy'], 2)),
                ('economy_feature_data', {}),
                ('strategy', round(default_pred['strategy'], 2)),
                ('strategy_feature_data', {}),
                ('predicted_price', int(round(np.exp(predicted_price), -3))),
                ('real_price', str(real_price))
            ])
        
        # Pydantic 스키마로 검증 후 DataFrame 변환
        # techdna_data = [
        #     StanineTechdnaSchema.model_validate(obj).model_dump()
        #     for obj in techdna_objs
        # ]
        df_techdna = pd.DataFrame([obj.__dict__ for obj in techdna_objs])
        df_techdna = df_techdna.drop(columns=['_sa_instance_state'], errors='ignore')

        # 3️⃣ TECHDNA_INPUT raw 컬럼 조회 (STANINE_TECHDNA에 없는 원본값)
        raw_input_row = (
            session.query(TechdnaIpforce)
            .filter(TechdnaIpforce.application_number == app_number)
            .first()
        )
        raw_input = {}
        if raw_input_row:
            raw_input = {
                "family_country_count": raw_input_row.family_country_count,
                "after_regi_year":      raw_input_row.after_regi_year,
                "division_app":         raw_input_row.division_app,
                "early_disclosure":     raw_input_row.early_disclosure,
                "image_cnt":            raw_input_row.image_cnt,
                "inventor_cnt":         raw_input_row.inventor_cnt,
            }

        # 4️⃣ StanineBscore 조회
        applicant_codes = df_techdna['applicant_code'].dropna().unique().tolist()
        
        if applicant_codes:
            bscore_objs = (
                session.query(StanineBscore)
                .filter(StanineBscore.applicant_code.in_(applicant_codes))
                .all()
            )
            if bscore_objs:
                # SQLAlchemy ORM 객체를 DataFrame으로 변환
                df_bscore = pd.DataFrame([obj.__dict__ for obj in bscore_objs])
                # SQLAlchemy 내부 메타 필드 제거
                df_bscore = df_bscore.drop(columns=['_sa_instance_state'], errors='ignore')
            else:
                df_bscore = pd.DataFrame()
                # print('bscore 없음')
        else:
            df_bscore = pd.DataFrame()
        
        # 4️⃣ 예측값 계산
        if df_bscore.empty:
            # 기본값 설정
            total_pred = {
                'tech': tech_score,
                'legal': 71.0,
                'market': 12.06,
                'economy': 32.0,
                'strategy': 44.0
            }
            feature_data = {
                'tech': tech_feature_data,
                'legal': {},
                'market': {},
                'economy': {},
                'strategy': {},
            }
            logger.info(f"Bscore 데이터 없음, 기본값 사용")
        else:
            # 데이터 병합 및 컬럼 매핑
            df_merged = pd.merge(df_techdna, df_bscore, on='applicant_code', how='left')
            df_merged.rename(columns=TECHDNA_COL, inplace=True)
            df_merged.rename(columns=BSCORE_COL, inplace=True)

            # bscore 컬럼 기준으로 NaN 아닌 row를 우선 사용
            # (특허 1건에 출원인이 여러 명일 때 매칭된 row가 뒤에 있을 수 있음)
            bscore_cols = list(BSCORE_COL.values())
            matched = df_merged.dropna(subset=bscore_cols, how='all')
            df_merged = matched if not matched.empty else df_merged
            
            # 각 feature 예측
            total_pred = {'tech': tech_score}
            feature_data = {'tech': tech_feature_data}
            
            for key in MODEL_COL.keys():
                if key.startswith('tech'):
                    continue  # tech는 이미 계산됨
                
                feature = df_merged[MODEL_COL[key]].copy()
                model, scaler = load_model_and_scaler(key)
                
                # 로그 변환 및 스케일링
                log_features = feature.apply(lambda x: np.log1p(x))
                scaled_features = scaler.transform(log_features.values)
                pred_score = model.predict(scaled_features)
                
                # legal, market, strategy는 exp 적용
                if key.split('_')[0] in ['legal', 'market', 'strategy']:
                    pred_score = np.exp(pred_score)
                
                dim = key.split('_')[0]
                total_pred[dim] = float(pred_score[0])

                # 각 지표별 raw 피처값 추출
                feature_data[dim] = _extract_raw_feature_data(dim, raw_input, df_bscore)
        
        # 5️⃣ 최종 가격 예측
        features = pd.DataFrame([total_pred])
        main_model = get_main_model()
        predicted_price = main_model.predict(features * 0.1)[0]
        
        # 6️⃣ 실제 가격 조회
        real_price = get_real_price(app_number)
        
        # 7️⃣ 응답 데이터 구성
        response_data = OrderedDict([
            ('application_number', app_number),
            ('tech', round(total_pred['tech'], 2)),
            ('tech_feature_data', feature_data.get('tech', {})),
            ('legal', round(total_pred['legal'], 2)),
            ('legal_feature_data', feature_data.get('legal', {})),
            ('market', round(total_pred['market'], 2)),
            ('market_feature_data', feature_data.get('market', {})),
            ('economy', round(total_pred['economy'], 2)),
            ('economy_feature_data', feature_data.get('economy', {})),
            ('strategy', round(total_pred['strategy'], 2)),
            ('strategy_feature_data', feature_data.get('strategy', {})),
            ('predicted_price', int(round(np.exp(predicted_price), -3))),
            ('real_price', str(real_price))
        ])
        
        logger.info(f"특허 가격 예측 완료: {app_number}")
        return response_data
    
    except Exception as e:
        logger.error(f"특허 가격 예측 오류 ({app_number}): {e}", exc_info=True)
        raise