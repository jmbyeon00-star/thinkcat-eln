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
from app.utils.es_client import get_es
from app.utils.embedding import get_embedding
from app.core.llm.search_intent import analyze_search_intent
from dotenv import load_dotenv
load_dotenv()

# 환경 변수 설정
MCP_ENDPOINT = os.getenv("MCP_ENDPOINT", "http://192.168.1.116:9999/mcp")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
# OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.1.20:11434/api/chat")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.1.20:11434/api/generate")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.20:11434")
SESSION_ID = os.getenv("SESSION_ID", "gemma_ollama_session")

ES_HOST = os.getenv("ES_HOST", None)
DB_HOST = os.getenv("DB_HOST", None)
DB_USER = os.getenv("DB_USER", None)
DB_PASS = os.getenv("DB_PASS", None)
DB_TYPE = os.getenv("DB_TYPE", None)

# ------------------------------------------
# ⚙️ 전역 설정
# ------------------------------------------
# BGEM3 모델은 앱 시작 시 한 번만 로드 (GPU/CPU 자동 감지)
# model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "address")
ES_USE_VECTOR   = os.getenv("ES_USE_VECTOR", "false").lower() == "true"

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
            should_clauses.append({
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                        "params": {"q": q_vec}
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
        es = get_es()
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

        # 1. exact match
        # exact = intent.get("exact_match", {})
        # if exact.get("application_number"):
        #     return {
        #         "term": {
        #             "application_number": exact["application_number"]
        #         }
        #     }

        # --------------------------------------------------
        # 1. exact match (UI > intent)
        # --------------------------------------------------
        ui_exact = options.get("exact_match", {})
        intent_exact = intent.get("exact_match", {})

        application_number = (
            ui_exact.get("application_number")
            or intent_exact.get("application_number")
        )
        if application_number:
            intent["exact_match"]["application_number"] = application_number
            return {
                "term": {
                    "application_number": application_number
                }
            }

        # 2. keyword
        ui_text_query = options.get("text_query", {})
        ui_keyword = ui_text_query.get("text_query", "").strip()
        # LLM이 분석한 키워드들
        intent_keywords = " ".join(intent.get("text_query", {}).get("keywords", [])).strip()
        fields = intent.get("text_query", {}).get("fields", ["title", "abstract"])

        # 가중치 설정
        boosted_fields = ["title^3", "abstract^2"] # 기본 가중치

        # A. UI에서 직접 입력한 키워드가 있는 경우 (최우선순위 가중치 부여)
        if ui_keyword:
            should.append({
                "multi_match": {
                    "query": ui_keyword,
                    "type": "best_fields",
                    "fields": boosted_fields,
                    # "boost": 10.0, # UI 입력 키워드에 아주 높은 점수 부여 (상단 노출 유도)
                    "operator": "or"
                }
            })
            print(f">>> [User Override] Using UI Keywords: {ui_keyword}")

        # B. LLM이 분석한 키워드 (기존 검색 로직 유지)
        elif intent_keywords:
            should.append({
                "multi_match": {
                    "query": intent_keywords,
                    "type": "best_fields",
                    "fields": boosted_fields,
                    # "boost": 1.0, # 일반적인 점수
                    "operator": "or"
                }
            })
            print(f">>> [LLM Intent] Using LLM Keywords: {intent_keywords}")

        # 2. filters
        # # filing_year = intent["filters"].get("filing_year")
        # # if filing_year:
        # #     filters.append({"range": {"filing_year": filing_year}})

        # filing_year = intent["filters"].get("filing_year")
        # if isinstance(filing_year, dict):
        #     range_body = {}


        #     if filing_year.get("from") is not None:
        #         range_body["gte"] = filing_year["from"]
        #     if filing_year.get("to") is not None:
        #         range_body["lte"] = filing_year["to"]
                
        #     if filing_year.get("gte") is not None:
        #         range_body["gte"] = filing_year["gte"]
        #     if filing_year.get("lte") is not None:
        #         range_body["lte"] = filing_year["lte"]

        #     if range_body:
        #         filters.append({
        #             "range": {
        #                 "filing_year": range_body
        #             }
        #         })

        # filing_date = intent["filters"].get("filing_date")
        # if filing_date and filing_date.get("from"):
        #     filters.append({
        #         "range": {
        #             "filing_date": {
        #                 "gte": filing_date["from"],
        #                 "lte": filing_date.get("to")
        #             }
        #         }
        #     })
        
        # --------------------------------------------------
        # 2-1. filing_year (UI override > intent)
        # --------------------------------------------------
        def pick(*values):
            for v in values:
                if v is not None:
                    return v
            return None
            
        ui_filing_year = options.get("filters", {}).get("filing_year") or {}
        intent_filing_year = intent.get("filters", {}).get("filing_year") or {}
        print(">>> ui_filing_year:", ui_filing_year)
        print(">>> intent_filing_year:", intent_filing_year)

        # 1️⃣ 최종 gte / lte 결정
        filing_year_gte = pick(
            ui_filing_year.get("gte"),
            intent_filing_year.get("gte"),
            intent_filing_year.get("from"),
        )

        filing_year_lte = pick(
            ui_filing_year.get("lte"),
            intent_filing_year.get("lte"),
            intent_filing_year.get("to"),
        )

        # 2️⃣ intent 동기화 (UI 자동 반영 목적)
        # intent.setdefault("filters", {}).setdefault("filing_year", {})
        if intent.get("filters") is None:
            intent["filters"] = {}

        if intent["filters"].get("filing_year") is None:
            intent["filters"]["filing_year"] = {}
        
        if filing_year_gte is not None:
            intent["filters"]["filing_year"]["gte"] = filing_year_gte

        if filing_year_lte is not None:
            intent["filters"]["filing_year"]["lte"] = filing_year_lte

        # 3️⃣ ES range 생성
        range_body = {}
        if filing_year_gte is not None:
            range_body["gte"] = filing_year_gte
        if filing_year_lte is not None:
            range_body["lte"] = filing_year_lte

        if range_body:
            filters.append({
                "range": {
                    "filing_year": range_body
                }
            })

        # --------------------------------------------------
        # 3. filing_date (현재는 intent만 사용)
        # --------------------------------------------------
        filing_date = intent.get("filters", {}).get("filing_date")
        if filing_date and filing_date.get("from"):
            filters.append({
                "range": {
                    "filing_date": {
                        "gte": filing_date["from"],
                        "lte": filing_date.get("to")
                    }
                }
            })

        # 4. text query
        # keywords = " ".join(intent["text_query"]["keywords"]).strip()
        # fields = intent["text_query"]["fields"]

        # if keywords:
        #     boosted = []
        #     for f in fields:
        #         if f == "title":
        #             boosted.append("title^3")
        #         elif f == "abstract":
        #             boosted.append("abstract^2")
        #         else:
        #             boosted.append(f)

        #     should.append({
        #         "multi_match": {
        #             "query": keywords,
        #             # "type": "cross_fields",
        #             # "operator": "and",
        #             "type": "best_fields",
        #             "operator": "or",
        #             "fields": boosted
        #         }
        #     })

        # 5. vector (optional)
        # if intent.get("use_vector") and query_vector is not None:
        # if query_vector is not None:
        #     should.append({
        #         "script_score": {
        #             "query": {"bool": {"filter": filters}},
        #             "script": {
        #                 "source": "cosineSimilarity(params.q, 'vector') + 1.0",
        #                 "params": {"q": query_vector.tolist()}
        #             }
        #         }
        #     })

        # --------------------------------------------------
        # 4. title exact match (UI 우선)
        # --------------------------------------------------
        ui_title = ui_exact.get("title")

        if ui_title:
            should.append({
                "match": {
                    "title": {
                        "query": ui_title,
                        "operator": "and"
                    }
                }
            })
        else:
            # --------------------------------------------------
            # 5. text query (intent 기반)
            # --------------------------------------------------
            keywords = " ".join(intent["text_query"]["keywords"]).strip()
            fields = intent["text_query"]["fields"]

            if keywords:
                boosted = []
                for f in fields:
                    if f == "title":
                        boosted.append("title^3")
                    elif f == "abstract":
                        boosted.append("abstract^2")
                    else:
                        boosted.append(f)

                should.append({
                    "multi_match": {
                        "query": keywords,
                        "type": "best_fields",
                        "operator": "or",
                        "fields": boosted
                    }
                })

        # --------------------------------------------------
        # 6. vector similarity (보조 should)
        # --------------------------------------------------
        if intent.get("use_vector") and query_vector is not None:
            # L2 정규화
            q_vec = np.array(query_vector)
            # norm = np.linalog.norm(q_vec)
            norm = np.linalg.norm(q_vec)
            if norm > 0:
                q_vec = q_vec / norm
            q_list = q_vec.tolist()

            should.append({
                "script_score": {
                    "query": {"bool": {"filter": filters }} if filters else {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                        "params": {
                            # "q": query_vector.tolist()
                            "q": q_list # L2 정규화된 리스트 사용
                        }
                    }
                }
            })

        # --------------------------------------------------
        # 7. inventor_name (UI override > intent)
        # --------------------------------------------------
        ui_inventor = options.get("filters", {}).get("inventor_name")
        intent_inventor = intent.get("filters", {}).get("inventor_name")

        if ui_inventor:
            intent["filters"]["inventor_name"] = ui_inventor

        inventor_name = ui_inventor or intent_inventor

        if inventor_name:
            filters.append({
                "match": {
                    "inventor_name": {
                        "query": inventor_name,
                        "operator": "or"
                    }
                }
            })

        # --------------------------------------------------
        # 8. applicant_name (UI override > intent)
        # --------------------------------------------------
        ui_applicant_name = options.get("filters", {}).get("applicant_name")
        intent_applicant_name = intent.get("filters", {}).get("applicant_name")

        # if ui_applicant_name:
            # intent["filters"]["applicant_name"] = ui_applicant_name

        applicant_name = ui_applicant_name or intent_applicant_name
        # print("\n\n\n\n\n>>>>>>>>>>>>>>> raw_query(user_query):", type(raw_query), raw_query, "<<<<<<<<<<<<<<<<<<\n\n\n\n\n" )

        if applicant_name:
            # filters.append({
            #     "match": {
            #         "applicant_name": {
            #             "query": applicant_name,
            #             "operator": "and"
            #         }
            #     }
            # })
            applicant_clause = {
                "bool": {
                    "should": [
                        # 1. Nori 분석기 (의미 단위 매칭)
                        { "match": { "applicant_name": { "query": applicant_name, "boost": 3.0 } } },
                        # 2. Ngram 매칭 (고유명사 변환/오타 대응)
                        { "match": { "applicant_name.ngram": { "query": applicant_name, "boost": 1.5 } } },
                        # 3. Keyword 완전 일치 (가장 높은 가중치)
                        { "term": { "applicant_name.keyword": { "value": applicant_name, "boost": 5.0 } } }
                    ],
                    "minimum_should_match": 1
                }
            }
            # should.append({
            #     "multi_match": {
            #         "query": raw_user_query,
            #         "fields": ["applicant_name^5", "title^3", "abstract"],
            #         "analyzer": "korean_analyzer" # Nori로 분석해서 매칭
            #     }
            # })
            filters.append(applicant_clause)

        # --------------------------------------------------
        # 8. query assembly
        # --------------------------------------------------
        if not should:
            return {
                "bool": {
                    "filter": filters
                }
            }

        query = {
            "bool": {
                "should": should,
                "minimum_should_match": 1
            }
        }

        if filters:
            query["bool"]["filter"] = filters
    except Exception as e:
        print(str(e))
        import sys
        exc_type, exc_obj, exc_tb = sys.exc_info()
        fname = os.path.split(exc_tb.tb_frame.f_code.co_filename)[1]
        print(f"=> Location: {fname}")
        print(f"=> Line: {exc_tb.tb_lineno}")
        print(f"=> Address: {exc_tb}")
        print(f"=> Error: {exc_type}")
        print(f"=> Content: {exc_obj}")
        print(f"=> Information: {sys.exc_info()}")

    return query


async def search_with_mcp(payload: dict):
    body = payload.get('body', {})
    user_query = body.get('query').strip()
    ui_options = body.get('options', {})
    # results = await search_with_ollama(user_query)

    # 1. 검색 의도 분석
    intent = await analyze_search_intent(user_query) if user_query else {}
    # print("\n\n\n>>> search mcp intent:", intent)

    if "filters" not in intent: intent["filters"] = {}
    
    filter_keys = ["applicant_name", "filing_year", "inventor_name", "applicant_code"]

    for key in filter_keys:
        ui_val = ui_options.get("filters", {}).get(key)
        intent_val = intent["filters"].get(key)
        
        # LLM이 분석을 못했거나({}) 비어있는데, UI(옵션)에는 값이 있는 경우 -> UI 값 유지
        if (not intent_val or intent_val == {}) and ui_val:
            intent["filters"][key] = ui_val

    # 2. 임베딩
    query_vector = None
    if user_query:
        query_vector = get_embedding(user_query)
    # print(">>>", query_vector, "<<<")

    # 3. ES DSL 생성
    query_dsl = build_es_query_from_intent(intent, ui_options, query_vector, raw_query=user_query)
    print("\n\n\n>>> search mcp query_dsl:", query_dsl)

    # 4. MCP 검색 실행
    MCP_CLIENT = Client(MCP_ENDPOINT)
    async with MCP_CLIENT:
        await MCP_CLIENT.call_tool("es-ping", {"req": {}})

        # ping_result = await MCP_CLIENT.call_tool("es-ping", {"req": {}})
        # if ping_result.data.get("is_error") or not ping_result.data.get("success"):
        #     error_message = ping_result.get('error', 'Unknown ES failure')
        #     raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

        # tool_objects = await MCP_CLIENT.list_tools()
        # tool_schemas = [
        #     tool.model_dump() 
        #     for tool in tool_objects
        # ]
        # tools_str = json.dumps(tool_schemas)
        
        tool_name = "es-search"
        search_args = {
            "index": "patent_data_v1",
            "track_total_hits": True,
            "size": 5,
            "query": query_dsl
        }
        # print("\n\n\nsearch_args:", search_args)

        mcp_response = await MCP_CLIENT.call_tool(
            tool_name,
            {"req": search_args}
        )
        # print("\n\n\nmcp_response:", mcp_response)

    return {
        "intent": intent,
        "results": mcp_response
    }

    # async with httpx.AsyncClient(timeout=30.0) as client:
    #     ollama_res = await client.post(OLLAMA_BASE_URL+"/api/chat", json=ollama_payload)
    #     llm_text = ollama_res.json()["message"]["content"]
    #     intent = extract_json(llm_text)
    #     print("intent:", intent)
        
#     # MCP 쿼리 호출
#     tool_name = "es-search"
#     index = "titleabstract_h"
#     # embedded_query = get_embedding(user_query)
#     # print("embedded_query:", embedded_query)

#     MAPPING_PROPS = {
#         "address": {"type": "long"}, 
#         "quote": {"type": "text"}, 
#         "vector": {"dims": 1024, "type": "dense_vector"}
#     }
    
#     from .search_service import _build_query
#     query_dsl = _build_query(
#         index=index,
#         props=MAPPING_PROPS,
#         keyword=user_query,
#         use_vector=True,
#         get_embedding_fn=get_embedding # BGEM3 임베딩 함수
#     )
#     # print("\n\n\n")
#     # print(json.dumps(query_dsl, indent=4, ensure_ascii=False))

#     search_args = {
#         "index": index, 
#         "track_total_hits": True,
#         "from": 0,
#         "size": 5,
#         "_source": ["address", "quote"],
#         "query": query_dsl, # 생성된 하이브리드 DSL (ID, term, vector script_score 포함)
#         "highlight": {
#             "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
#             "fields": {"quote": {}}
#         }
#     }
#     try:
#         request_params = { 
#             "index": "titleabstract_h", 
#             "query": {"match": {"content_field": user_query}},
#             "size": 5
#         }

#         mcp_response = await MCP_CLIENT.call_tool(tool_name, {"req": search_args})
#         # print("강제 검색 결과:", type(mcp_response))
#         # print(f"✅ 강제 검색 성공. 결과 수: {len(mcp_response.get('results', {}).get('hits', {}).get('hits', []))}")
        
# #         # 3-4. 2차 LLM 호출 (최종 답변 생성) - 기존 코드의 2차 호출 로직 사용
#         # final_response_data = await second_ollama_call(user_query, mcp_response)
#         # return final_response_data

#     except Exception as e:
#         print(">>> 강제 검색 오류", str(e))
#         pass
            
    # mcp_response = await MCP_CLIENT.call_tool(tool_name, request_params)
            
    # print("\n--- 최종 결과 ---")
    # print(json.dumps(intent, indent=4, ensure_ascii=False))

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

            # if ping_result.get("success"):
            if ping_result.data.get("success"):
                print("✅ MCP 서버와 Elasticsearch 연결 성공.")
            else:
                error_message = ping_result.get('error', 'Unknown ES failure')
                print(f"❌ MCP 연결 성공, ES 핑 실패: {error_message}")
                raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

            # 2. 도구 스키마 로드
            # tool_schemas = await MCP_CLIENT.list_tools()

            # list_tools는 Tool 객체의 리스트를 반환합니다.
            tool_objects = await MCP_CLIENT.list_tools() 
            
            # 🚨 수정: 각 Tool 객체를 JSON 직렬화가 가능한 딕셔너리로 변환
            tool_schemas = [
                # 대부분의 Pydantic 객체는 to_dict() 또는 model_dump()를 제공합니다.
                # .model_dump()를 사용하여 딕셔너리 리스트로 변환합니다.
                tool.model_dump() 
                for tool in tool_objects
            ]
            tools_str = json.dumps(tool_schemas)
            print(f"📦 MCP 서버에서 {len(tool_schemas)}개의 도구 스키마 로드 완료.")

            # 3. Ollama API 호출 및 Tool Calling 로직 (이하 동일)
            # ollama_payload = {
            #     "model": OLLAMA_MODEL,
            #     "prompt": user_query,
            #     "options": {
            #         "system": f"You are a helpful assistant. You have access to the following tools: {tools_str}. Use the tools to answer the question if necessary.",
            #     },
            #     "stream": False 
            # }
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