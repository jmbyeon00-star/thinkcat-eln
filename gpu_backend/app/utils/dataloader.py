# app/utils/dataloader.py
from fastapi import HTTPException
from app.utils.db_connecter import db_connect

import os, sys, json, traceback
import pandas as pd

from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from dotenv import load_dotenv

load_dotenv()
BACKEND_URL = os.getenv("BACKEND_URL", "http://backend:8000")

# --- local safe helpers (공용 util에 의존하지 않도록 최소 정의) ---
def safe_encode_decode(x):
    try:
        if isinstance(x, str):
            return x.encode('utf-8', errors='ignore').decode('utf-8', errors='ignore')
        return "" if x is None else str(x)
    except Exception:
        return "" if x is None else str(x)

def print_error(_os, _sys):
    # 간단한 스택 트레이스 출력
    etype, evalue, etb = sys.exc_info()
    if evalue:
        try:
            line = traceback.extract_tb(etb)[-1].lineno
        except Exception:
            line = "?"
        print(f"[ERROR] dataloader: {etype.__name__}: {evalue} (line {line})")

# --- Optional: torch용 커스텀 Dataset (토치 트레이너에서 안쓰면 무시) ---
class CustomDataset(Dataset):
    def __init__(self, df):
        self.df = df.reset_index(drop=True)

    def __len__(self):
        return len(self.df)

    def __getitem__(self, idx):
        try:
            text = self.df.iloc[idx, 0]  # 'source'
            label = int(self.df.iloc[idx, 1])  # 'target'
            return text, label
        except Exception as e:
            print(f"Error in CustomDataset.__getitem__: {str(e)}")
            try:
                print(f"Error occurred on line {traceback.extract_tb(e.__traceback__)[-1].lineno}")
            except Exception:
                pass
            return "", 0

# ----- DB fetch -----
def fetch_train_data(config):
    user_id = config["user_id"]
    target_id = config["target_id"]
    target_code = config["target_code"]
    group_code = config["group_code"]
    
    run_type = config["run_type"]
    data_scope = config["data_scope"]
    task_type = config["task_type"]
    source_type = config["source_type"]
    collection_names = config.get("collection_names", [])
    updated_dt = config.get("updated_datetime")

    connection, cursor = db_connect()
    result = []

    try:
        if task_type == "classification":
            
            where = ""
            params = [user_id]

            if data_scope == "project":
                if not target_id:
                    raise ValueError("target_id(project_id) must be provided when data_scope='project'")
                where = " AND project_id=%s AND group_code=%s"
                params.append(target_id)
                params.append(group_code)

            elif data_scope == "collection":
                if not collection_names:
                    raise ValueError("collection_names must be provided when data_scope='collection'")
                placeholders = ",".join(["%s"] * len(collection_names))
                where = f" AND collection_name IN ({placeholders})"
                params.extend(collection_names)

            else:
                raise ValueError("Unknown data_scope type")

            # if run_type == "retrain":
            #     if not updated_dt:
            #         raise ValueError("updated_datetime must be provided for retrain")
            #     where += " AND updated_datetime > %s"
            #     params.append(updated_dt)

            query = "SELECT title, abstract, collection_name, used, group_code FROM PROJECT_DATA_TB WHERE user_id=%s" + where
            cursor.execute(query, params)
            result = cursor.fetchall()

        elif task_type == "recommendation":
            # positive / COUNTER 데이터를 구성
            if not target_id:
                raise ValueError("target_id(collection_id) must be provided when task_type='recommendation'")

            # 1️⃣ 기준이 되는 컬렉션 정보 조회
            cursor.execute(
                "SELECT collection_code FROM COLLECTION_INFO_TB WHERE id=%s AND user_id=%s",
                (target_id, user_id)
            )
            collection_info = cursor.fetchone()
            if not collection_info:
                raise ValueError("collection not found")

            # 2️⃣ 학습 데이터 조회
            extra = ""
            params = []

            if run_type == "retrain":
                if not updated_dt:
                    raise ValueError("updated_datetime must be provided for retrain")
                extra = " AND updated_datetime > %s"
                params.append(updated_dt)

            if source_type == "search":
                # DB 기반 프로젝트의 경우 collection_code 기준으로 데이터 가져오기
                query = f"""
                    SELECT title, abstract, collection_name, used
                    FROM PROJECT_DATA_TB
                    WHERE collection_code = %s
                    AND user_id = %s
                    {extra}
                """
                cursor.execute(query, (target_code, user_id, *params))

            elif source_type == "upload":
                # FILE 기반 프로젝트의 경우 project_code 기준으로 데이터 가져오기
                query = f"""
                    SELECT title, abstract, collection_name, used
                    FROM PROJECT_DATA_TB
                    WHERE project_code = (
                        SELECT project_code FROM COLLECTION_INFO_TB WHERE id=%s
                    )
                    AND user_id = %s
                    {extra}
                """
                cursor.execute(query, (target_id, user_id, *params))

            else:
                raise ValueError(f"Unknown source_type: {source_type}")

            result = cursor.fetchall()
            
        else:
            raise HTTPException(status_code=404, detail="데이터를 찾을 수 없습니다.")

    except Exception as e:
        print(f"DB Error: {str(e)}")
        print_error(os, sys)
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            connection.close()
        except Exception:
            pass
    return result

# ----- 분류용 전처리 -----
def set_classification_data(raw_rows, data_scope, source_type):
    """
    raw_rows: list[dict] from DB
    returns: pd.DataFrame with columns ['source','target']
    """
    if not raw_rows:
        return pd.DataFrame(columns=['source','target'])

    df = pd.DataFrame(raw_rows)
    # 안전하게 문자열화
    df['title'] = df.get('title', '').map(safe_encode_decode)
    df['abstract'] = df.get('abstract', '').map(safe_encode_decode)
    df['collection_name'] = df.get('collection_name', '').fillna('').map(safe_encode_decode)

    df['source'] = (df['title'] + "\n" + df['abstract']).str.strip()
    # 기본 라벨 셋팅
    df.loc[(df['collection_name'] != ''), 'target'] = df['collection_name']

    # 프로젝트+DB(=search)에서 used==0 → COUNTER
    if str(data_scope).lower() == "project" and str(source_type).lower() == 'search':
        if 'used' in df.columns:
            df.loc[df['used'] == 0, 'target'] = "COUNTER"

    return df[['source', 'target']]

# ----- 추천용 전처리 -----
def set_recommendation_data(raw_rows, config):
    """
    raw_rows: list[dict]
    config: dict with keys like source_type, source_type, collection_name(optional)
    returns: pd.DataFrame ['source','target']
    
    추천 학습 데이터 구성
    - used=1 : Positive
    - used=0 : COUNTER
    - source_type='db'(search) / 'file'(upload) 자동 분기
    """
    if not raw_rows:
        print("⚠️ set_recommendation_data: raw_rows is empty.")
        return pd.DataFrame(columns=['source','target'])
    
    # --- 기본 변수 ---
    source_type = str(config.get('source_type', '')).lower()
    target_collection_name = config.get('collection_name')  # optional
    df = pd.DataFrame(raw_rows).copy()

    # --- 인코딩 및 필드 정리 ---
    df['title'] = df.get('title', '').map(safe_encode_decode)
    df['abstract'] = df.get('abstract', '').map(safe_encode_decode)
    df['collection_name'] = df.get('collection_name', '').fillna('').map(safe_encode_decode)
    # df['used'] = df.get('used', 1).fillna(1).astype(int)

     # --- source & 기본 target 설정 (collection_name) ---
    df['source'] = (df['title'] + "\n" + df['abstract']).str.strip()
    df['target'] = df['collection_name']
    # df.loc[(df['collection_name'] != ''), 'target'] = df['collection_name']

    # ===================================================================
    # CASE 1️⃣ : DB형 프로젝트 (source_type == "db" or "search")
    # ===================================================================
    if source_type in ("db", "search"):
        # used=0 → COUNTER
        if 'used' in df.columns:
            df.loc[df['used'] == 0, 'target'] = "COUNTER"
            df.loc[df['used'] == 1, 'target'] = df['collection_name']
        return df[['source', 'target']].dropna().query("source != '' and target != ''")

    # ===================================================================
    # CASE 2️⃣ : 파일형 프로젝트 (source_type == "file")
    # ===================================================================
    # target_collection 지정된 경우, 그 컬렉션은 Positive로,
    # 나머지 used=0 또는 다른 컬렉션은 COUNTER로 처리
    elif source_type == 'file':
        # 파일 기반일 때 특정 컬렉션만 양성으로, 나머지는 COUNTER로 샘플링하는 전략
        # target_collection_name이 없으면 균형잡힌 COUNTER 샘플링을 생략하고 전체 COUNTER로 단순 처리
        if not target_collection_name:
            # target 명시 없으면 used 기준으로만 나눔
            df.loc[df['used'] == 0, 'target'] = "COUNTER"
            df.loc[df['used'] == 1, 'target'] = df['collection_name']
            return df[['source', 'target']].dropna().query("source != '' and target != ''")
        
        # (1) Positive: 지정된 컬렉션 + used=1
        df_target = df[(df['collection_name'] == target_collection) & (df['used'] == 1)]

        # (2) COUNTER: 다른 컬렉션 or used=0
        df_counter_pool = df[(df['collection_name'] != target_collection) | (df['used'] == 0)]

        if df_target.empty:
            print(f"⚠️ [FILE] target_collection '{target_collection}' has no positive samples → using full COUNTER dataset")
            df_counter_pool['target'] = "COUNTER"
            return df_counter_pool[['source', 'target']]#.dropna().query("source != '' and target != ''")

        # (3) 컬렉션별 균형 샘플링
        counts = df_counter_pool['collection_name'].value_counts()
        keys = list(counts.index)
        if len(keys) <= 1:
            print("⚠️ [FILE] only one or no COUNTER collection available → sampling skipped")
            df_counter_pool['target'] = "COUNTER"
            df_final = pd.concat([df_target.assign(target=target_collection), df_counter_pool], ignore_index=True)
            return df_final[['source', 'target']].dropna().query("source != '' and target != ''")

        sampled = []
        n_per = max(1, len(df_target) // max(1, len(keys)))
        for k in keys:
            subset = df_counter_pool[df_counter_pool['collection_name'] == k]
            sampled.append(subset.sample(n=min(n_per, len(subset)), random_state=42))
        df_counter = pd.concat(sampled, ignore_index=True) if sampled else df_counter_pool
        df_counter['target'] = 'COUNTER'

        df_final = pd.concat(
            [df_target.assign(target=target_collection), df_counter],
            ignore_index=True
        )

        # 컬렉션별 균형 샘플링
        sampled = []
        counts = df_counter_pool['collection_name'].value_counts()
        keys = list(counts.index)
        n_per = max(1, len(df_target) // max(1, len(keys)))
        
        for k in keys:
            subset = df_counter_pool[df_counter_pool['collection_name'] == k]
            sampled.append(subset.sample(n=min(n_per, len(subset)), random_state=42))
        df_counter = pd.concat(sampled, ignore_index=True) if sampled else df_counter_pool
        df_counter['target'] = 'COUNTER'

        df_final = pd.concat(
            [df_target.assign(target=target_collection), df_counter],
            ignore_index=True
        )

        return df_final[['source', 'target']].dropna().query("source != '' and target != ''")
    else:
        # ===================================================================
        # CASE 3️⃣ : 예외 fallback
        # ===================================================================
        print(f"⚠️ [FALLBACK] Unknown source_type='{source_type}' → using used flag only")
        df.loc[df['used'] == 0, 'target'] = "COUNTER"
        return df[['source', 'target']].dropna().query("source != '' and target != ''")

# ----- 데이터 분포 체크 -----
def log_used_distribution(df, label="train"):
    try:
        total = len(df)
        counter = (df['target'] == 'COUNTER').sum()
        positive = total - counter
        ratio = (counter / total * 100) if total > 0 else 0
        msg = f"[{label.upper()} DATA] total={total} | positive={positive} | counter={counter} ({ratio:.1f}% COUNTER)"
        print(msg)

        # if backend_url and model_id:
        #     payload = {
        #         "message": msg,
        #         "progress": 0,
        #     }
        #     try:
        #         httpx.post(f"{backend_url}/api/status/progress/train/{model_id}", json=payload, timeout=3.0)
        #     except Exception:
        #         pass
    except Exception as e:
        print(f"[WARN] Failed to log distribution for {label}: {e}")

# ----- 메인: 학습 데이터 -----
def get_train_data(config):
    user_id = config["user_id"]
    target_id = config["target_id"]
    """
    반환: ({'train': df_train, 'valid': df_valid, 'mapping': mapping}, lengths)
    - Sklearn 트레이너: df 사용
    - Torch 트레이너: 이 형태도 수용(내가 준 트레이너가 수용하도록 작성됨)
    """
    try:
        raw = fetch_train_data(config)

        task_type = str(config.get('task_type', '')).lower()
        data_scope = config.get('data_scope')
        source_type = config.get('source_type')
        
        if task_type == 'classification':
            df = set_classification_data(raw, data_scope, source_type)
        elif task_type == 'recommendation':
            df = set_recommendation_data(raw, config)
        else:
            raise ValueError("Unknown task_type")
        
        # 정리/인코딩
        df[['source', 'target']] = df[['source', 'target']].apply(lambda col: col.map(safe_encode_decode))
        df = df.drop_duplicates(subset=['source'], keep='first', ignore_index=True)
        df = df.dropna(subset=['source', 'target']).query("source != '' and target != ''")
        
        # 클래스 편향이 심할 때 stratify 에러 방지: 최소 test_size를 클래스 수 기반으로 보호
        num_classes = df['target'].nunique()
        min_test_size = num_classes / max(1, len(df))

        shuffle_db_value = config["shuffle"]
        df_train, df_valid = train_test_split(
            df, test_size=max(0.1, min_test_size), random_state=42, stratify=df['target'], shuffle=bool(shuffle_db_value)
        )
        
        # 데이터 분포도 체크
        log_used_distribution(df_train, "train")
        log_used_distribution(df_valid, "valid")

        # 라벨 인코딩 및 매핑 저장
        encoder = LabelEncoder()
        df_train['target'] = encoder.fit_transform(df_train['target'])
        df_valid['target'] = encoder.transform(df_valid['target'])

        mapping = dict(enumerate(encoder.classes_))
        model_path = config.get('model_path')
        if model_path:  # 경로가 온 경우에만 저장
            os.makedirs(model_path, exist_ok=True)
            with open(os.path.join(model_path, "mapping.json"), 'w', encoding='utf-8') as f:
                json.dump(mapping, f, ensure_ascii=False)

        lengths = {'train': len(df_train), 'valid': len(df_valid)}
        packaged = {'train': df_train, 'valid': df_valid, 'mapping': mapping}
        print(">>> train data:", df_train.head())
        # print(">>> train data:", df_train.shape, df_valid.shape)
        
        return packaged, lengths

    except Exception:
        print_error(os, sys)
        return {'error': 'get_train_data failed'}, 400

def prepare_dataframe(config: dict, raw_data: list[dict]) -> tuple[pd.DataFrame, dict]:
    """
    raw_data: [{title, abstract, collection_name, used, ...}]
    출력: df_train, df_valid, mapping(dict: idx->label), lengths
    """
    df = pd.DataFrame(raw_data)
    df['patent'] = (df.get('title','').fillna('') + " " + df.get('abstract','').fillna('')).str.strip()
    # 라벨 기본: collection_name
    df.loc[df['collection_name'].notnull(), 'label'] = df['collection_name']

    # 프로젝트/소스 유형 규칙 (플라스크 로직 이식)
    if config.get('data_type') == 'project' and str(config.get('source_type','')).lower() == 'serch':
        # 사용 안 된 데이터 COUNTER로
        if 'used' in df.columns:
            df.loc[df['used'] == 0, 'label'] = "COUNTER"

    df = df[['patent', 'label']].dropna().query("patent != '' and label != ''").drop_duplicates('patent')

    df_train, df_valid = train_test_split(
        df, test_size=0.1, random_state=42, stratify=df['label']
    )
    le = LabelEncoder()
    df_train['label'] = le.fit_transform(df_train['label'])
    df_valid['label'] = le.transform(df_valid['label'])
    mapping = dict(enumerate(le.classes_))
    lengths = {'train': len(df_train), 'valid': len(df_valid)}
    return df_train, df_valid, mapping, lengths


def fetch_infer_data(file_id: str):
    """
    추론용 데이터 로드 (FILE_DATA_TB)
    - file_id 기준으로 title, abstract 불러옴
    - 학습 데이터와 달리 라벨 정보(collection_name)는 없음
    - 출력: pd.DataFrame(['source'])
    """
    connection, cursor = db_connect()
    result = []

    try:
        query = """
            SELECT title, abstract, source, target
            FROM FILE_DATA_TB
            WHERE file_id = %s
            ORDER BY id
        """
        cursor.execute(query, (file_id,))
        result = cursor.fetchall()

    except Exception as e:
        print(f"DB Error in fetch_infer_data: {e}")
    finally:
        try:
            cursor.close()
        except Exception:
            pass
        try:
            connection.close()
        except Exception:
            pass

    if not result:
        return pd.DataFrame(columns=["source"])

    df = pd.DataFrame(result)
    # df["title"] = df.get("title", "").map(safe_encode_decode)
    # df["abstract"] = df.get("abstract", "").map(safe_encode_decode)
    # df["source"] = (df["title"].fillna('') + "\n" + df["abstract"].fillna('')).str.strip()
    df["source"] = df.get("source", "").map(safe_encode_decode)
    df["target"] = df.get("target", "").map(safe_encode_decode)

    # 중복/결측 제거
    df = df.drop_duplicates(subset=["source"]).dropna(subset=["source"]).query("source != ''")
    return df

def get_inference_classification_data(config: dict):
    user_id = config["user_id"]
    file_id = config["file_id"]
    """
    반환: {'data': df, 'mapping': mapping}
    - FILE_DATA_TB에서 데이터 로드
    - 학습 때 저장된 mapping.json 로드
    """
    try:
        model_path = config["model_path"]
        # file_code = config["file_code"]
        # if not file_code:
        #     raise ValueError("file_code is required")

        # 1️⃣ 파일 데이터 로드
        df = fetch_infer_data(file_id)
        if df.empty:
            raise ValueError("no data found for file_id")

        # 2️⃣ 안전 인코딩
        df["source"] = df["source"].map(safe_encode_decode)
        df = df.drop_duplicates(subset=["source"], keep="first", ignore_index=True)
        df = df.dropna(subset=["source"]).query("source != ''")

        # 3️⃣ mapping.json 로드 (학습 때 저장된)
        mapping_path = os.path.join(model_path, "mapping.json")
        if os.path.exists(mapping_path):
            with open(mapping_path, "r", encoding="utf-8") as f:
                mapping = json.load(f)
        else:
            mapping = {}

        packaged = {"data": df, "mapping": mapping}
        lengths = {"total": len(df)}
        return packaged, lengths

    except Exception:
        print_error(os, sys)
        return {"error": "get_inference_classification_data failed"}, 400

def set_inference_recommendation_data(config: dict):
    connection, cursor = db_connect()
    
    try:
        query = """
            SELECT mean_vector, collection_category
            FROM COLLECTION_INFO_TB
            WHERE id=%s AND user_id=%s
        """
        cursor.execute(query, (config["collection_id"], config["user_id"]))
        collection_info = cursor.fetchone()
        if not collection_info:
            return {"error": "collection information not found"}, 404
    finally:
        try: cursor.close()
        except: pass
        try: connection.close()
        except: pass

    # 1️⃣ Elasticsearch 후보군 조회
    loader = PatentDataLoader()

    # category = collection_info["collection_name"][:1].lower()
    category = collection_info["collection_category"][:1].lower()
    print(">>> recommedation category:", category)
    mean_vector = collection_info["mean_vector"]

    # print(">>> Elasticsearch 후보군 조회 중...")
    df_candidates = loader.get_candidates(category, mean_vector)
    if df_candidates.empty:
        raise ValueError("no candidates found from Elasticsearch")
    
    # 결과 확인용
    # for col in list(df_candidates.columns):
    #     print(f"{col}: {df_candidates.iloc[0][col]}")

    # 2️⃣ 안전 인코딩 + 중복제거
    df_candidates["title"] = df_candidates["title"].map(safe_encode_decode)
    df_candidates["abstract"] = df_candidates["abstract"].map(safe_encode_decode)
    df_candidates["source"] = (
        df_candidates["title"].fillna("") + " " + df_candidates["abstract"].fillna("")
    )
    df_candidates = df_candidates.drop_duplicates(subset=["source"], keep="first", ignore_index=True)
    df_candidates = df_candidates.dropna(subset=["source"]).query("source != ''")

    # 3️⃣ mapping.json 로드 (학습 때 저장된)
    mapping_path = os.path.join(config["model_path"], "mapping.json")
    
    # 파일 존재 여부 확인용
    # print("model_path:", config["model_path"])
    # print("exists:", os.path.exists(config["model_path"]))
    # print("files in dir:", os.listdir(os.path.dirname(config["model_path"])))
    
    if os.path.exists(mapping_path):
        with open(mapping_path, "r", encoding="utf-8") as f:
            mapping = json.load(f)
    else:
        mapping = {}
    
    # 4️⃣ 패키징
    packaged = {"data": df_candidates, "mapping": mapping}
    lengths = {"total": len(df_candidates)}

    return packaged, lengths

# --------------------------
# 추천 모델 추론 데이터
# --------------------------
import torch
import pandas as pd
from elasticsearch import Elasticsearch
from FlagEmbedding import BGEM3FlagModel
from app.utils.es_client import get_es

ES_HOST = os.getenv("ES_HOST", "http://backend:8000")
class PatentDataLoader:
    def __init__(self):
        self.client = get_es()
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        # self.model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True, device=self.device)

    def get_candidates(self, category: str, keyword_or_vector):
        """Elasticsearch에서 유사 특허 후보군 조회"""
        category_mapping = {
            "1": "a", "2": "b", "3": "c", "4": "d",
            "5": "e", "6": "f", "7": "g", "8": "h", "9": "y"
        }
        index = f"titleabstract_{category_mapping.get(category, 'a')}"
        if not keyword_or_vector:
            return []

        # 쿼리 생성
        if isinstance(keyword_or_vector, str):
            # text → vector 변환
            embedding = self.get_embeddings(keyword_or_vector)
            query = self._build_query_from_vector(embedding, index)
        else:
            # 이미 vector 전달됨
            query = self._build_query_from_vector(keyword_or_vector, index)

        # Elasticsearch 검색
        response = self.client.search(
            index=index,
            body={"query": query, "size": 500, "_source": ["address", "vector"]},
            request_timeout=240
        )

        # 결과 정리
        results = [
            {
                "application_number": str(hit["_source"]["address"]),
                "score": hit["_score"],
                "vector": hit["_source"]["vector"]
            }
            for hit in response["hits"]["hits"]
        ]

        # DB 상세정보 결합
        df_score = pd.DataFrame(results)
        df_detail = self._get_db_info(df_score["application_number"].tolist())
        return self._merge_results(df_detail, df_score)

    def get_embeddings(self, text):
        # 실제 임베딩 모델 불러올 때 사용
        # return self.model.encode(text, batch_size=12, max_length=1024)["dense_vecs"]
        return [0.1] * 1024  # dummy

    def _build_query_from_vector(self, vector, index):
        return {
            "script_score": {
                "query": {"match_all": {}},
                "script": {
                    "source": "cosineSimilarity(params.inquiry_vector, 'vector') + 1.0",
                    "params": {"inquiry_vector": vector}
                }
            }
        }

    def _get_db_info(self, app_numbers):
        """MySQL에서 상세 특허 정보 조회"""
        if not app_numbers:
            return pd.DataFrame()
        
        connection, cursor = db_connect()

        try:
            in_query = ",".join([f"'{num}'" for num in app_numbers])
            query = f"""
                SELECT application_number, filing_date, title, abstract,
                    applicant_code, cpc_code, ipc_code
                FROM PATENT_DATA_TB
                WHERE application_number IN ({in_query})
            """
            cursor.execute(query)
            rows = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description]

        finally:
            try: cursor.close()
            except: pass
            try: connection.close()
            except: pass
        return pd.DataFrame(rows, columns=columns)

    def _merge_results(self, df_detail, df_score):
        """검색된 데이터와 점수 데이터를 병합 및 정렬"""
        if df_detail.empty or df_score.empty:
            return pd.DataFrame()

        # 🔧 타입 통일 (핵심)
        df_detail["application_number"] = df_detail["application_number"].astype(str)
        df_score["application_number"] = df_score["application_number"].astype(str)

        df_total = pd.merge(df_detail, df_score, on="application_number")
        df_total.sort_values("score", ascending=False, inplace=True)
        df_total.reset_index(drop=True, inplace=True)
        return df_total