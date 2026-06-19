import os, sys
import re
import json
import traceback
import requests
import asyncio
import httpx
import numpy as np

from fastapi import HTTPException
from fastmcp import Client
from fastmcp.client.logging import LogMessage

from typing import Tuple, List, Dict, Optional, Optional, Any
from pymysql.connections import Connection
from pymysql.cursors import Cursor, DictCursor

from app.utils.db_connecter import db_connect
# from app.utils.es_client import get_es
from app.utils.os_client import get_os
from app.utils.embedding import get_embedding
from app.core.llm.search_intent import analyze_search_intent
from dotenv import load_dotenv
load_dotenv()

# 환경 변수 설정
MCP_ENDPOINT = os.getenv("MCP_ENDPOINT", "http://192.168.1.116:9999/mcp")
mcp_client = Client(MCP_ENDPOINT)

OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
# OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.1.20:11434/api/chat")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.1.20:11434/api/generate")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.20:11434")
SESSION_ID = os.getenv("SESSION_ID", "gemma_ollama_session")

# ES_HOST = os.getenv("ES_HOST", None)
OPENSEARCH_HOST = os.getenv("OPENSEARCH_HOST", None)
DB_HOST = os.getenv("DB_HOST", None)
DB_USER = os.getenv("DB_USER", None)
DB_PASS = os.getenv("DB_PASS", None)
DB_TYPE = os.getenv("DB_TYPE", None)


# ------------------------------------------
# ⚙️ 전역 설정
# ------------------------------------------
# BGEM3 모델은 앱 시작 시 한 번만 로드 (GPU/CPU 자동 감지)
# model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

# ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
# ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "address")
# ES_USE_VECTOR   = os.getenv("ES_USE_VECTOR", "false").lower() == "true"
ES_INDEX_PREFIX = os.getenv("OPENSEARCH_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("OPENSEARCH_KEY_FIELD", "address")
ES_USE_VECTOR   = os.getenv("OPENSEARCH_USE_VECTOR", "false").lower() == "true"

_get_embedding: Optional[callable] = None
if ES_USE_VECTOR:
    try:
        from app.utils.embedding import get_embedding as _get_embedding
    except Exception:
        _get_embedding = None  # 임베딩 모듈이 없으면 벡터 검색 비활성화

# ------------------------------------------
# 🔧 내부 헬퍼 함수
# ------------------------------------------
def _get_index_properties(es, index: str) -> Dict:
    """
    인덱스 매핑에서 properties만 뽑아온다. 인덱스가 없거나 오류면 빈 dict 반환.
    """
    try:
        if not es.indices.exists(index=index):
            return {}
        m = es.indices.get_mapping(index=index)
        return m.get(index, {}).get("mappings", {}).get("properties", {}) or {}
    except Exception:
        return {}


def _pick_available(props: Dict, candidates: List[str]) -> List[str]:
    """매핑에 실제 존재하는 필드만 반환"""
    return [f for f in candidates if f in props]

def _build_query(
    index: str,
    props: Dict,
    keyword: str,
    use_vector: bool,
    get_embedding_fn: Optional[callable],
) -> Dict:
    """ES 검색 쿼리 구성 (텍스트 + 벡터 옵션 포함)"""
    should_clauses: List[Dict] = []

    # 1) 텍스트 검색
    text_candidates = ["title", "abstract", "claims", "description", "quote"]
    text_fields = _pick_available(props, text_candidates)
    if text_fields:
        boosted = []
        for f in text_fields:
            if f == "title":
                boosted.append("title^3")
            elif f == "abstract":
                boosted.append("abstract^2")
            else:
                boosted.append(f)
        should_clauses.append({"multi_match": {"query": keyword, "fields": boosted}})

    # 2) 벡터 검색
    has_vector_field = "vector" in props
    can_vector_search = use_vector and has_vector_field and get_embedding_fn is not None
    if can_vector_search:
        try:
            q_vec = get_embedding_fn(keyword)
        except Exception:
            q_vec = None
        
        if isinstance(q_vec, np.ndarray):
            q_vec = q_vec.tolist()
        if isinstance(q_vec, (list, tuple)) and len(q_vec) > 0:
            # # [ES] script_score 방식
            # should_clauses.append({
            #     "script_score": {
            #         "query": {"match_all": {}},
            #         "script": {
            #             "source": "cosineSimilarity(params.q, 'vector') + 1.0",
            #             "params": {"q": q_vec}
            #         }
            #     }
            # })
            # [OpenSearch] knn 쿼리 방식
            should_clauses.append({
                "knn": {
                    "vector": {
                        "vector": q_vec,
                        "k": 100
                    }
                }
            })
    
    if not should_clauses:
        return {"match_all": {}}
    return {"bool": {"should": should_clauses}}


# ------------------------------------------
# 📄 출원번호 검색
# ------------------------------------------
# def search_by_application(session: Session, app_num: str) -> Dict:
#     return fetch_patent_by_appnum(session, app_num) or {}


# ------------------------------------------
# 🧾 등록번호 검색
# ------------------------------------------
# def search_by_registration(session: Session, reg_num: str) -> Dict:
#     return fetch_patent_by_regnum(session, reg_num) or {}


# ------------------------------------------
# 🔍 키워드 검색 (MySQL + ES) (BGEM3 + Elasticsearch)
# ------------------------------------------
def search_by_keyword(
    section: str,
    keyword: str,
    page: int,
    size: int
) -> Tuple[int, List[Dict], List[Dict]]:
    """
    ES + MySQL 통합 검색
    """
    connection, cursor = db_connect()
    try:
        # es = get_es()
        es = get_os()
        index = f"{ES_INDEX_PREFIX}{section.lower()}"

        if not es.indices.exists(index=index):
            return 0, [], []

        props = _get_index_properties(es, index)
        source_candidates = [ES_KEY_FIELD, "quote", "vector"]
        source_fields = _pick_available(props, source_candidates)
        if ES_KEY_FIELD not in source_fields:
            source_fields.insert(0, ES_KEY_FIELD)

        highlight_fields: Dict[str, Dict] = {}
        for f in ["title", "abstract", "quote"]:
            if f in props:
                highlight_fields[f] = {"number_of_fragments": 0}

        query = _build_query(index, props, keyword, ES_USE_VECTOR, _get_embedding)
        body = {
            "track_total_hits": True,
            "from": (page - 1) * size,
            "size": size,
            "_source": source_fields,
            "query": query,
            "highlight": {
                "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
                "fields": highlight_fields
            }
        }

        res = es.search(index=index, body=body)
        total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]
        hits_raw = res["hits"]["hits"]

        # 1차 ES 결과
        order_keys: List[str] = []
        es_map: Dict[str, Dict] = {}
        hits: List[Dict] = []
        for h in hits_raw:
            src = h.get("_source") or {}
            k = str(src.get(ES_KEY_FIELD) or "")
            if not k:
                continue
            order_keys.append(k)
            es_map[k] = {
                "key": k,
                "vector": src.get("vector"),
                # "score": h.get("_score"),
                # "score": round(h.get("_score") or 0, 4),
                "score": float(h.get("_score")) if h.get("_score") is not None else None,
                "title_es": src.get("title") or src.get("quote"),
                "abstract_es": src.get("abstract") or src.get("quote"),
            }
            hits.append({
                "key": k,
                "score": h.get("_score"),
                "highlight": h.get("highlight", {}),
                "title": src.get("title") or src.get("quote"),
                "abstract": src.get("abstract") or src.get("quote"),
            })

        # 2차 MySQL 조회
        results: List[Dict] = []
        if order_keys:
            rows = fetch_by_keys(connection, cursor, order_keys)
            words = keyword.strip().split()
            label = words[0] if len(words) == 1 else " ".join(words[:2])

            for r in rows:
                k = str(r.get("application_number"))
                es_info = es_map.get(k, {})
                results.append({
                    "application_number": r.get("application_number"),
                    "title": r.get("title") or es_info.get("title_es"),
                    "abstract": r.get("abstract") or es_info.get("abstract_es"),
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                    "vector": es_info.get("vector"),
                    "score": es_info.get("score"),
                    "cpc_code": r.get("cpc_code"),
                    "collection_name": label,
                })
        
        print(f"검색어 {keyword}, 결과: {total}개, DB 조회결과: {len(results)}개")
        return int(total), list(es_map.values()), results #hits, results

    except Exception as e:
        print("❌ SEARCH ERROR:", e)
        # traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass

# ------------------------------------------
# 🧩 MySQL 보조 함수들
# ------------------------------------------
def fetch_by_keys(connection: Connection, cursor: DictCursor, keys: List[str]) -> List[Dict[str, Any]]:
    if not keys:
        return []

    placeholders = ', '.join(['%s'] * len(keys))
    sql = f"""
        SELECT application_number, title, abstract, filing_date, grant_date, cpc_code, ipc_code
        FROM PATENT_RESULT_TB
        WHERE application_number IN ({placeholders})
    """
    cursor.execute(sql, tuple(keys))
    rows = cursor.fetchall()

    out = []
    for r in rows:
        out.append({
            "application_number": r["application_number"],
            "title": r.get("title"),
            "abstract": r.get("abstract"),
            "filing_date": r.get("filing_date"),
            "grant_date": r.get("grant_date"),
            "cpc_code": (r.get("cpc_code") or "").split('|')[0][:4],
            "ipc_code": (r.get("ipc_code") or "").split('|')[0][:4],
        })
    return out

def fetch_patent_by_appnum(application_number: str) -> Optional[Dict]:
    connection, cursor = db_connect()
    try:
        sql = """
            SELECT *
            FROM PATENT_RESULT_TB
            WHERE application_number = %s
        """
        cursor.execute(sql, (application_number,))
        return cursor.fetchone()
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass

def fetch_vectors_by_appnums(app_nums: List[str]) -> Dict[str, List[float]]:
    """
    여러 출원번호에 대해 Elasticsearch에서 벡터값을 일괄 조회합니다.
    """
    if not app_nums:
        return {}

    # es = get_es()
    es = get_os()
    # 모든 섹션 인덱스(titleabstract_*)를 대상으로 검색
    index_pattern = f"{ES_INDEX_PREFIX}*"
    
    results = {}
    try:
        # app_nums 리스트를 중복 제거하고 숫자만 남긴 리스트 생성 (ES address 필드는 long 타입)
        # 또한 원본 번호와 매핑하기 위해 dict 등으로 관리할 수도 있지만, 
        # 일단 숫자만 남긴 값으로 조회하고 결과에서도 해당 키로 반환합니다.
        
        # 🎯 [중요] ES의 address 필드는 long이므로 하이픈(-) 등을 제거한 숫자만 유효합니다.
        clean_to_orig = {}
        for a in app_nums:
            if not a: continue
            clean_a = re.sub(r'[^0-9]', '', str(a))
            if clean_a:
                clean_to_orig[clean_a] = str(a)

        unique_clean_nums = list(clean_to_orig.keys())
        
        # 100개 단위로 나누어 조회 (ES query size 및 performance 고려)
        batch_size = 100
        for i in range(0, len(unique_clean_nums), batch_size):
            batch = unique_clean_nums[i:i + batch_size]
            
            body = {
                "size": batch_size,
                "_source": [ES_KEY_FIELD, "vector"],
                "query": {
                    "terms": {
                        ES_KEY_FIELD: batch
                    }
                }
            }
            
            res = es.search(index=index_pattern, body=body)
            hits = res.get("hits", {}).get("hits", [])
            
            for hit in hits:
                src = hit.get("_source", {})
                # ES에서 돌려받은 address 값을 다시 문자열로 변환
                addr_val = str(src.get(ES_KEY_FIELD))
                vec = src.get("vector")
                
                if addr_val and vec:
                    # 원본 출원번호가 있으면 원본 번호를 키로 저장 (사용자 입력값과 매칭을 위해)
                    orig_app_num = clean_to_orig.get(addr_val, addr_val)
                    results[orig_app_num] = vec
                    
    except Exception as e:
        print(f"❌ Error in fetch_vectors_by_appnums: {e}")
        # 로깅 후 빈 결과 반환 (프로세스 중단 방지)
        
    return results

def fetch_patent_by_regnum(reg_number: str) -> Dict[str, Any]:
    """
    등록번호(reg_number)로 특허 단건 조회 (MySQL)
    """
    connection, cursor = db_connect()
    try:
        sql = """
            SELECT
                reg_number,
                application_number,
                title,
                abstract,
                filing_date,
                grant_date,
                cpc_code,
                ipc_code
            FROM PATENT_RESULT_TB
            WHERE reg_number = %s
            LIMIT 1
        """
        cursor.execute(sql, (reg_number,))
        row = cursor.fetchone()

        if not row:
            return {}

        return {
            "reg_number": row.get("reg_number"),
            "application_number": row.get("application_number"),
            "title": row.get("title"),
            "abstract": row.get("abstract"),
            "filing_date": row.get("filing_date"),
            "grant_date": row.get("grant_date"),
            "cpc_code": (row.get("cpc_code") or "").split("|")[0][:4],
            "ipc_code": (row.get("ipc_code") or "").split("|")[0][:4],
        }

    except Exception as e:
        print("❌ fetch_patent_by_regnum ERROR:", e)
        return {}
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass

# >>> 2026-01-28
def build_standard_es_query(options: dict, query_vector=None):
    """
    Elasticsearch DSL 생성을 위한 일반 검색 전용 함수.
    AI 분석값(intent) 없이 오직 유저의 UI 입력값만 사용합니다.
    """
    try:
        filters = []
        should = []
        
        # 1. Exact Match (출원번호)
        app_num = options.get("exact_match", {}).get("application_number")
        if app_num:
            filters.append({"term": {"application_number": app_num}})

        # 2. 필터 설정 (연도, 출원인, 발명인)
        ui_filters = options.get("filters", {})
        
        # 출원 연도
        year = ui_filters.get("filing_year", {})
        gte, lte = year.get("gte"), year.get("lte")
        if gte or lte:
            range_query = {}
            if gte: range_query["gte"] = gte
            if lte: range_query["lte"] = lte
            filters.append({"range": {"filing_year": range_query}})

        # 출원인
        applicant = ui_filters.get("applicant_name")
        if applicant:
            filters.append({
                "bool": {
                    "should": [
                        { "match": { "applicant_name": { "query": applicant, "boost": 3.0 } } },
                        { "term": { "applicant_name.keyword": { "value": applicant, "boost": 5.0 } } }
                    ],
                    "minimum_should_match": 1
                }
            })

        # 발명인
        inventor = ui_filters.get("inventor_name")
        if inventor:
            filters.append({"match": {"inventor_name": {"query": inventor}}})

        # 3. 키워드 검색 (Text Query)
        # 프론트엔드에서 보낸 검색어(text_query)를 사용
        target_kw = options.get("text_query", {}).get("text_query", "").strip()
        if target_kw:
            should.append({
                "multi_match": {
                    "query": target_kw,
                    "fields": ["title^3", "abstract^2"],
                    "type": "best_fields"
                }
            })

        # 4. 벡터 검색 (하이브리드)
        if options.get("use_vector", True) and query_vector is not None:
            # # [ES] script_score 방식
            # should.append({
            #     "script_score": {
            #         "query": {"match_all": {}},
            #         "script": {
            #             "source": "cosineSimilarity(params.q, 'vector') + 1.0",
            #             "params": {"q": query_vector}
            #         }
            #     }
            # })
            # [OpenSearch] knn 쿼리 방식
            should.append({
                "knn": {
                    "vector": {
                        "vector": query_vector,
                        "k": 100
                    }
                }
            })

        # 최종 쿼리 조립
        if not should:
            return {"bool": {"filter": filters}} if filters else {"match_all": {}}
        
        return {
            "bool": {
                "should": should,
                "filter": filters,
                "minimum_should_match": 1
            }
        }

    except Exception as e:
        print(f"Standard Query Build Error: {e}")
        return {"match_all": {}}

async def search_standard(payload: dict):
    try:
        # 1. 페이로드 추출
        body = payload.get('body', {})
        user_query = body.get('query', '').strip()
        ui_options = body.get('options', {})
        reference_patents = body.get('reference_patents', [])

        page = body.get('page', 1)
        size = body.get('size', 10)
        start_from = (page - 1) * size

        # 안전장치: 1,000개(100페이지) 넘어가면 제한 (선택사항)
        if start_from >= 1000:
            return {"error": "Maximum page limit (100) exceeded."}

        # 2. 임베딩 생성 (하이브리드/벡터 검색용)
        query_vector = None
        if user_query:
            raw_vector = get_embedding(user_query)
            query_vector = raw_vector.tolist() if hasattr(raw_vector, 'tolist') else list(raw_vector)

        # 참조 특허가 있으면 쿼리 벡터와 결합
        if reference_patents:
            search_method = body.get('search_method', 'centroid')
            patent_texts = [f"{p.get('title', '')} {p.get('abstract', '')}" for p in reference_patents]
            patent_embeddings = [get_embedding(text) for text in patent_texts]
            patent_vectors = np.array([
                e.tolist() if hasattr(e, 'tolist') else list(e)
                for e in patent_embeddings
            ])
            reference_centroid = np.mean(patent_vectors, axis=0)

            if query_vector is not None:
                query_vec_array = np.array(query_vector)

                # 검색 방식에 따라 다른 가중치 적용
                if search_method == 'weighted':
                    # weighted: 검색어 의도를 중시 (쿼리 80%, 참조 특허 20%)
                    combined_vector = 0.8 * query_vec_array + 0.2 * reference_centroid
                elif search_method == 'script_score':
                    # script_score: 참조 특허를 중시 (쿼리 40%, 참조 특허 60%)
                    combined_vector = 0.4 * query_vec_array + 0.6 * reference_centroid
                else:
                    # centroid (기본): 균형 잡힌 검색 (쿼리 60%, 참조 특허 40%)
                    combined_vector = 0.6 * query_vec_array + 0.4 * reference_centroid

                query_vector = combined_vector.tolist()
            else:
                query_vector = reference_centroid.tolist()

            print(f"[DEBUG] Standard search - query + {len(reference_patents)} reference patents (method: {search_method})")

        # 3. ES DSL 생성
        if "text_query" not in ui_options:
            ui_options["text_query"] = {}
        ui_options["text_query"]["text_query"] = user_query

        query_dsl = build_standard_es_query(options=ui_options, query_vector=query_vector)
   
        # 4. MCP 검색 실행
        # MCP_CLIENT = Client(MCP_ENDPOINT)
        # async with MCP_CLIENT:
        async with mcp_client:
            # MCP 서버 상태 체크
            # await MCP_CLIENT.call_tool("es-ping", {"req": {}})
            
            tool_name = "es-search"
            search_args = {
                "index": "patent_data_v1",
                "track_total_hits": True, # 전체 결과 개수를 알기 위해 필수
                "from": start_from, # 시작 위치
                "size": size, # 페이지당 개수
                "query": query_dsl
            }

            # MCP 서버의 es-search 도구 호출
            mcp_response = await mcp_client.call_tool(tool_name, {"req": search_args})

        return {
            "results": mcp_response
        }
    except Exception as e:
        print(f"[ERROR] Standard Search {str(e)}")
        return {"error": "Standard Search failed", "details": str(e)}
# <<<

# >>> 2025-12-16 ~ 17
def parse_llm_json(text: str) -> dict:
        # ```json ... ``` 또는 ``` ... ``` 제거
        cleaned = re.sub(r"```(?:json)?\s*", "", text)
        cleaned = re.sub(r"\s*```", "", cleaned)
        return json.loads(cleaned)

def build_es_query_from_intent(intent: dict, options: dict, query_vector=None, raw_query=None):
    try:
        filters = []
        should = []
        
        # 헬퍼 함수: 유효한 값을 순서대로 선택
        def pick(*values):
            for v in values:
                if v is not None and v != "" and v != []:
                    return v
            return None

        # 기본 구조 보장
        if "filters" not in intent: intent["filters"] = {}
        if "exact_match" not in intent: intent["exact_match"] = {}
        if "text_query" not in intent: intent["text_query"] = {}

        ui_filters = options.get("filters", {})
        ui_exact = options.get("exact_match", {})
        ui_text_query = options.get("text_query", {})

        # 1. Exact Match (출원번호)
        app_num = pick(ui_exact.get("application_number"), intent.get("exact_match", {}).get("application_number"))
        if app_num:
            filters.append({"term": {"application_number": app_num}})
            intent["exact_match"]["application_number"] = app_num

        # 2. 출원 연도 (Range) - [데이터 형식 오류 방어]
        ui_year = ui_filters.get("filing_year", {}) or {}
        intent_year_raw = intent.get("filters", {}).get("filing_year", {})

        # AI가 None, 숫자, 또는 dict로 보낼 수 있음
        if intent_year_raw is None:
            intent_year = {}
        elif isinstance(intent_year_raw, (int, str)):
            intent_year = {"gte": int(intent_year_raw), "lte": int(intent_year_raw)}
        else:
            intent_year = intent_year_raw

        gte = pick(ui_year.get("gte"), intent_year.get("gte"), intent_year.get("from"))
        lte = pick(ui_year.get("lte"), intent_year.get("lte"), intent_year.get("to"))

        range_body = {}
        if gte: range_body["gte"] = gte
        if lte: range_body["lte"] = lte
        
        if range_body:
            filters.append({"range": {"filing_year": range_body}})
            intent["filters"]["filing_year"] = range_body

        # 3. 출원인 (Applicant)
        applicant_name = pick(ui_filters.get("applicant_name"), intent.get("filters", {}).get("applicant_name"))
        if applicant_name:
            intent["filters"]["applicant_name"] = applicant_name
            filters.append({
                "bool": {
                    "should": [
                        { "match": { "applicant_name": { "query": applicant_name, "boost": 3.0 } } },
                        { "term": { "applicant_name.keyword": { "value": applicant_name, "boost": 5.0 } } }
                    ],
                    "minimum_should_match": 1
                }
            })

        # 4. 발명인 (Inventor)
        inventor_name = pick(ui_filters.get("inventor_name"), intent.get("filters", {}).get("inventor_name"))
        if inventor_name:
            intent["filters"]["inventor_name"] = inventor_name
            filters.append({"match": {"inventor_name": {"query": inventor_name}}})

        # 5. 텍스트 검색 (Keywords) - [원문 백업 로직 추가]
        ui_keyword = ui_text_query.get("text_query", "").strip()
        intent_keywords = " ".join(intent.get("text_query", {}).get("keywords", [])).strip()
        # UI -> AI 키워드 -> 사용자가 입력한 원래 문장(raw_query) 순으로 탐색
        target_keywords = pick(ui_keyword, intent_keywords, raw_query)

        if target_keywords:
            should.append({
                "multi_match": {
                    "query": target_keywords,
                    "fields": ["title^3", "abstract^2", "claims"],
                    "type": "best_fields",
                    "operator": "or"
                }
            })

        # 6. 벡터 검색 (Hybrid)
        if intent.get("use_vector", True) and query_vector is not None:
            # numpy array인 경우 list로 변환
            q_vec = query_vector.tolist() if hasattr(query_vector, 'tolist') else query_vector
            # # [ES] script_score 방식
            # should.append({
            #     "script_score": {
            #         "query": {"match_all": {}},
            #         "script": {
            #             "source": "cosineSimilarity(params.q, 'vector') + 1.0",
            #             "params": {"q": q_vec}
            #         }
            #     }
            # })
            # [OpenSearch] knn 쿼리 방식
            should.append({
                "knn": {
                    "vector": {
                        "vector": q_vec,
                        "k": 100
                    }
                }
            })

        # 7. 최종 쿼리 조립 [검색 결과 0건 방지 로직]
        if not should:
            return {"bool": {"filter": filters}} if filters else {"match_all": {}}
        
        query_body = {
            "bool": {
                "should": should,
                "filter": filters
            }
        }

        # 필터(연도, 출원인 등)가 없을 때는 키워드/벡터 중 하나라도 맞아야 하므로 1 적용
        # 필터가 있을 때는 필터만 맞아도 결과가 나오게 하기 위해 1을 생략 (가산점 모드)
        if not filters:
            query_body["bool"]["minimum_should_match"] = 1
            
        return query_body

    except Exception as e:
        print(f"❌ Error building query: {e}")
        import traceback
        traceback.print_exc()
        return {"match_all": {}}

async def search_with_mcp(payload: dict):
    body = payload.get('body', {})
    user_query = (body.get('query') or '').strip()
    ui_options = body.get('options', {})
    reference_patents = body.get('reference_patents', [])

    page = body.get('page', 1)
    size = body.get('size', 10)
    start_from = (page - 1) * size

    # 안전장치: 1,000개(100페이지) 넘어가면 제한 (선택사항)
    if start_from >= 1000:
        return {"error": "Maximum page limit (100) exceeded."}

    # 1. 검색 의도 분석
    intent = await analyze_search_intent(user_query) if user_query else {}
    if "filters" not in intent: intent["filters"] = {}

    filter_keys = ["applicant_name", "filing_year", "inventor_name", "applicant_code"]
    for key in filter_keys:
        ui_val = ui_options.get("filters", {}).get(key)
        intent_val = intent["filters"].get(key)
        if (not intent_val or intent_val == {}) and ui_val:
            intent["filters"][key] = ui_val

    # 2. 임베딩 (쿼리 + 참조 특허 결합)
    intent_keywords = ' '.join(intent.get("text_query", {}).get("keywords", []))
    query_vector = None

    if user_query:
        query_vector = get_embedding(intent_keywords or user_query)

    # 참조 특허가 있으면 쿼리 벡터와 결합
    if reference_patents:
        search_method = body.get('search_method', 'centroid')
        patent_texts = [f"{p.get('title', '')} {p.get('abstract', '')}" for p in reference_patents]
        patent_embeddings = [get_embedding(text) for text in patent_texts]
        patent_vectors = np.array([
            e.tolist() if hasattr(e, 'tolist') else list(e)
            for e in patent_embeddings
        ])
        reference_centroid = np.mean(patent_vectors, axis=0)

        if query_vector is not None:
            query_vec_array = np.array(query_vector.tolist() if hasattr(query_vector, 'tolist') else list(query_vector))

            # 검색 방식에 따라 다른 가중치 적용
            if search_method == 'weighted':
                # weighted: 검색어 의도를 중시 (쿼리 80%, 참조 특허 20%)
                combined_vector = 0.8 * query_vec_array + 0.2 * reference_centroid
            elif search_method == 'script_score':
                # script_score: 참조 특허를 중시 (쿼리 40%, 참조 특허 60%)
                combined_vector = 0.4 * query_vec_array + 0.6 * reference_centroid
            else:
                # centroid (기본): 균형 잡힌 검색 (쿼리 60%, 참조 특허 40%)
                combined_vector = 0.6 * query_vec_array + 0.4 * reference_centroid

            query_vector = combined_vector
        else:
            query_vector = reference_centroid

        print(f"[DEBUG] Combined search - query + {len(reference_patents)} reference patents (method: {search_method})")

    # 3. ES DSL 생성
    query_dsl = build_es_query_from_intent(intent, ui_options, query_vector, raw_query=user_query)

    # 4. MCP 검색 실행
    # async with MCP_CLIENT:
    async with mcp_client:
        # await MCP_CLIENT.call_tool("es-ping", {"req": {}})
        tool_name = "es-search"
        search_args = {
            "index": "patent_data_v1",
            "track_total_hits": True,
            "from": start_from,
            "size": size,
            "query": query_dsl
        }

        mcp_response = await mcp_client.call_tool(tool_name, {"req": search_args})
    return {
        "intent": intent,
        "results": mcp_response
    }

    return str(intent)
# <<<

# 2025-12-09
async def search_with_mcp1(payload: dict):
    user_query = payload.get('query', {}).get('query')
    results = await search_with_ollama(user_query)
    
    print("\n--- 최종 결과 ---")
    print(json.dumps(results, indent=4, ensure_ascii=False))

    return results

async def search_with_ollama(user_query: str):
    try:
        # 1. FastMCP 클라이언트 초기화 및 연결
        MCP_CLIENT = Client(MCP_ENDPOINT)

        async with MCP_CLIENT:
            ping_result = await MCP_CLIENT.call_tool("es-ping", {"req": {}})
            print(f"DEBUG: ES-PING RAW RESULT: {ping_result}")

            if ping_result.data.get("success"):
                print("✅ MCP 서버와 Elasticsearch 연결 성공.")
            else:
                error_message = ping_result.get('error', 'Unknown ES failure')
                print(f"❌ MCP 연결 성공, ES 핑 실패: {error_message}")
                raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

            # 2. 도구 스키마 로드
            tool_objects = await MCP_CLIENT.list_tools() 
            tool_schemas = [
                tool.model_dump() 
                for tool in tool_objects
            ]
            tools_str = json.dumps(tool_schemas)
            # print(f"MCP 서버에서 {len(tool_schemas)}개의 도구 스키마 로드 완료.")

            ollama_payload = {
                "model": OLLAMA_MODEL,
                "prompt": user_query,
                "options": {
                    "system": f"You are a helpful assistant. You have access to the following tools: {tools_str}. Use the tools to answer the question if necessary.",
                },
                "stream": False 
            }

            response = requests.post(OLLAMA_API_URL, json=ollama_payload)
            response.raise_for_status()
            ollama_output = response.json()
            llm_response_text = ollama_output.get("response", "").strip()

            # Ollama 응답 분석 (Tool Call 결정)
            if llm_response_text.startswith('{') and llm_response_text.endswith('}'):
                try:
                    tool_call_json = json.loads(llm_response_text)
                    tool_name = tool_call_json.get("tool_name")
                    request_params = tool_call_json.get("request", tool_call_json.get("params", {}))

                    if tool_name:
                        print(f"💡 Gemma가 도구 호출 결정: {tool_name}")
                        
                        # FastMCP 클라이언트를 통해 실제 도구 실행 (await 사용)
                        mcp_response = await MCP_CLIENT.call_tool(tool_name, request_params) 
                        
                        print(f"✅ {tool_name} 결과 수신 성공.")
                        
                        # (추가) 이 mcp_response를 다시 Ollama에 보내 최종 답변 생성 유도 필요
                        return { "status": "tool_executed", "tool_name": tool_name, "mcp_result": mcp_response }

                except Exception as tool_e:
                    print(f"경고: Tool Call 처리 중 오류 발생: {tool_e}")
                    # Tool Call 오류 시, 일반 답변 로직으로 폴백하거나 에러를 반환
                    return {"error": f"Tool Execution Failed: {tool_e}"}

            print("💬 Gemma가 일반 답변을 생성합니다.")
            return {"status": "success", "response": llm_response_text}

    # 'async with' 블록 외부의 Exception 처리
    except requests.exceptions.RequestException as e:
        return {"error": f"Ollama API 호출 실패: {e}"}
    except Exception as e:
        print(f"경고: MCP 서버 연결 또는 설정 실패. 오류: {e}")
        # MCP 클라이언트 초기화 실패 또는 연결 실패 시
        return {"error": f"MCP Client Connection Failed: {e}"}


# >>> 2026-02-09: 유사 특허 검색
async def search_similar(payload: dict):
    """
    선택한 특허들을 기반으로 유사 특허를 검색합니다.

    지원 방식:
    - centroid: 선택한 특허들의 벡터 평균(중심점)으로 검색 (가장 빠름)
    - script_score: 각 특허와의 유사도를 합산 (정확하지만 느림)
    - weighted: 검색어에 가중치를 부여한 평균 (검색어 의도 중시)
    """
    try:
        body = payload.get('body', {})
        method = body.get('method', 'centroid')
        patents = body.get('patents', [])
        exclude_app_numbers = body.get('exclude_app_numbers', [])
        size = body.get('size', 10)
        page = body.get('page', 1)
        start_from = (page - 1) * size

        if not patents:
            return {"error": "No patents provided", "results": {"hits": {"hits": [], "total": {"value": 0}}}}

        # 1. 선택한 특허들의 텍스트 추출
        patent_texts = [f"{p.get('title', '')} {p.get('abstract', '')}" for p in patents]

        # 2. 검색 방식에 따라 쿼리 벡터 생성
        if method == 'centroid':
            # 모든 특허의 임베딩을 평균
            embeddings = [get_embedding(text) for text in patent_texts]
            embeddings_array = np.array([
                e.tolist() if hasattr(e, 'tolist') else list(e)
                for e in embeddings
            ])
            centroid = np.mean(embeddings_array, axis=0)
            query_vector = centroid.tolist()

            # 단일 script_score 쿼리
            query_dsl = _build_similar_query_centroid(query_vector, exclude_app_numbers)

        elif method == 'script_score':
            # 각 특허의 임베딩으로 개별 score 계산 후 합산
            embeddings = [get_embedding(text) for text in patent_texts]
            vectors = [
                e.tolist() if hasattr(e, 'tolist') else list(e)
                for e in embeddings
            ]
            query_dsl = _build_similar_query_script_score(vectors, exclude_app_numbers)

        elif method == 'weighted':
            # 가중치 평균: 첫 번째 특허에 더 높은 가중치 부여
            embeddings = [get_embedding(text) for text in patent_texts]
            embeddings_array = np.array([
                e.tolist() if hasattr(e, 'tolist') else list(e)
                for e in embeddings
            ])

            # 첫 번째 특허에 2배 가중치
            weights = np.ones(len(embeddings))
            if len(weights) > 0:
                weights[0] = 2.0
            weights = weights / weights.sum()

            weighted_centroid = np.average(embeddings_array, axis=0, weights=weights)
            query_vector = weighted_centroid.tolist()

            query_dsl = _build_similar_query_centroid(query_vector, exclude_app_numbers)

        else:
            return {"error": f"Unknown method: {method}"}

        # 3. MCP를 통해 ES 검색 실행
        async with mcp_client:
            search_args = {
                "index": "patent_data_v1",
                "track_total_hits": True,
                "from": start_from,
                "size": size,
                "query": query_dsl
            }

            mcp_response = await mcp_client.call_tool("es-search", {"req": search_args})
        
        return {
            "method": method,
            "patent_count": len(patents),
            "results": mcp_response
        }

    except Exception as e:
        print(f"[ERROR] Similar Search: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": "Similar search failed", "details": str(e)}


def _build_similar_query_centroid(query_vector: list, exclude_app_numbers: list) -> dict:
    """
    평균 벡터(centroid)를 사용한 유사도 검색 쿼리 생성
    """
    must_not = []
    if exclude_app_numbers:
        must_not.append({"terms": {"application_number": exclude_app_numbers}})

    # # [ES] script_score 방식
    # return {
    #     "script_score": {
    #         "query": {
    #             "bool": {"must_not": must_not}
    #         } if must_not else {"match_all": {}},
    #         "script": {
    #             "source": "cosineSimilarity(params.q, 'vector') + 1.0",
    #             "params": {"q": query_vector}
    #         }
    #     }
    # }
    # [OpenSearch] knn 쿼리 방식
    knn_clause = {
        "knn": {
            "vector": {
                "vector": query_vector,
                "k": 100
            }
        }
    }
    if must_not:
        return {"bool": {"must": [knn_clause], "must_not": must_not}}
    return knn_clause


def _build_similar_query_script_score(vectors: list, exclude_app_numbers: list) -> dict:
    """
    여러 벡터의 유사도를 합산하는 검색 쿼리 생성
    (각 벡터와의 cosine similarity를 모두 더함)
    """
    must_not = []
    if exclude_app_numbers:
        must_not.append({"terms": {"application_number": exclude_app_numbers}})

    # # [ES] 여러 벡터 유사도 합산 script_score 방식
    # script_parts = []
    # params = {}
    # for i, vec in enumerate(vectors):
    #     param_name = f"v{i}"
    #     params[param_name] = vec
    #     script_parts.append(f"cosineSimilarity(params.{param_name}, 'vector')")
    # script_source = " + ".join(script_parts) + f" + {len(vectors)}.0"
    # return {
    #     "script_score": {
    #         "query": {"bool": {"must_not": must_not}} if must_not else {"match_all": {}},
    #         "script": {"source": script_source, "params": params}
    #     }
    # }

    # [OpenSearch] 여러 벡터를 평균내어 단일 knn 쿼리로 처리
    dim = len(vectors[0])
    avg_vector = [sum(v[i] for v in vectors) / len(vectors) for i in range(dim)]
    knn_clause = {
        "knn": {
            "vector": {
                "vector": avg_vector,
                "k": 100
            }
        }
    }
    if must_not:
        return {"bool": {"must": [knn_clause], "must_not": must_not}}
    return knn_clause
# <<<