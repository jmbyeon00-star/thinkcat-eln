import os
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


# >>> 2025-12-16
def parse_llm_json(text: str) -> dict:
        # ```json ... ``` 또는 ``` ... ``` 제거
        cleaned = re.sub(r"```(?:json)?\s*", "", text)
        cleaned = re.sub(r"\s*```", "", cleaned)
        return json.loads(cleaned)

def extract_json(text: str):
    match = re.search(r'\{.*\}', text, re.S)
    if not match:
        raise ValueError("JSON 객체 없음")
    return json.loads(match.group())

async def search_with_mcp(payload: dict):
    user_query = payload.get('query', {}).get('query')
    # results = await search_with_ollama(user_query)

    {
        "search_type": "exact | text | semantic | hybrid",
        "exact_match": {
            "application_number": null,
            "publication_number": null
        },
        "filters": {
            "filing_year": null,
            "filing_date": {
            "from": null,
            "to": null
            },
            "inventor_country_code": null,
            "end_status": null
        },
        "text_query": {
            "keywords": [],
            "fields": ["title", "abstract", "claim"]
        },
        "use_vector": false,
        "confidence": 0.0
    }

    system_prompt = """너는 특허 검색 질의를 분석하는 AI다.
사용자의 자연어 검색 문장을 분석하여,
아래 JSON 스키마에 맞게 검색 의도를 구조화하라.

규칙:
- 절대 설명하지 말고 JSON만 출력하라 
- 없는 조건은 null 또는 빈 배열로 둬라
- 날짜 표현은 ISO-8601 (YYYY-MM-DD)
- 날짜가 상대 표현이면 오늘 날짜 기준으로 계산하라
- CPC는 섹션(A~H) 단위까지만 추론하라
- 확실하지 않으면 빈 배열로 둬라"""
    
    ollama_payload = {
                "model": OLLAMA_MODEL,
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_query
                    }
                ],
                "stream": False
            }
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:           
            ollama_res = await client.post(OLLAMA_BASE_URL+"/api/chat", json=ollama_payload)
            llm_text = ollama_res.json()["message"]["content"]
            intent = extract_json(llm_text)
            print("intent:", intent)

            # 1. exact 검색 우선 처리
            exact = intent["exact_match"]
            if exact.get("application_number"):
                return {
                    "query": {
                        "term": {
                            "application_number": exact["application_number"]
                        }
                    }
                }

            # 2. filter는 값 있을 때만
            filters = []
            if intent["filters"].get("filing_year"):
                filters.append({
                    "term": {
                        "filing_year": intent["filters"]["filing_year"]
                    }
                })

            filing_date = intent["filters"].get("filing_date")
            if filing_date and filing_date.get("from"):
                filters.append({
                    "range": {
                        "filing_date": {
                            "gte": filing_date["from"]
                        }
                    }
                })

            # 3. 텍스트 검색
            keywords = " ".join(intent["text_query"]["keywords"])
            fields = intent["text_query"]["fields"]

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
                    "fields": boosted
                }
            })

            # 4. 벡터 검색은 선택적
            if intent["use_vector"]:
                should.append({
                    "script_score": {
                        "query": { "bool": { "filter": filters } },
                        "script": {
                            "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                            "params": { "q": query_vector }
                        }
                    }
                })
            print("should:", should)
        except httpx.HTTPStatusError as e:
            print(f"Ollama 서버 오류 발생: {e.response.status_code}")
            return {"role": "assistant", "content": f"AI 서버 오류가 발생했습니다: {e.response.text}"}
        except Exception as e:
            print(f"Ollama 통신 오류: {e}")
            return {"role": "assistant", "content": f"AI 서버 통신 오류가 발생했습니다: {e}"}


        # MCP Server 연결 및 tool 사용
        MCP_CLIENT = Client(MCP_ENDPOINT)
        async with MCP_CLIENT:
            ping_result = await MCP_CLIENT.call_tool("es-ping", {"req": {}})
            print(f"DEBUG: ES-PING RAW RESULT: {ping_result}")
            if ping_result.data.get("is_error") or not ping_result.data.get("success"):
                error_message = ping_result.get('error', 'Unknown ES failure')
                raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

            tool_objects = await MCP_CLIENT.list_tools()
            tool_schemas = [
                tool.model_dump() 
                for tool in tool_objects
            ]
            tools_str = json.dumps(tool_schemas)
            print(f"MCP 서버에서 {len(tool_schemas)}개의 도구 스키마 로드 완료.")
        
            # MCP 쿼리 호출
            tool_name = "es-search"
            index = "titleabstract_h"
            # embedded_query = get_embedding(user_query)
            # print("embedded_query:", embedded_query)

            MAPPING_PROPS = {
                "address": {"type": "long"}, 
                "quote": {"type": "text"}, 
                "vector": {"dims": 1024, "type": "dense_vector"}
            }
            
            from .search_service import _build_query
            query_dsl = _build_query(
                index=index,
                props=MAPPING_PROPS,
                keyword=user_query,
                use_vector=True,
                get_embedding_fn=get_embedding # BGEM3 임베딩 함수
            )
            # print("\n\n\n")
            # print(json.dumps(query_dsl, indent=4, ensure_ascii=False))

            search_args = {
                "index": index, 
                "track_total_hits": True,
                "from": 0,
                "size": 5,
                "_source": ["address", "quote"],
                "query": query_dsl, # 생성된 하이브리드 DSL (ID, term, vector script_score 포함)
                "highlight": {
                    "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
                    "fields": {"quote": {}}
                }
            }
            try:
                request_params = { 
                    "index": "titleabstract_h", 
                    "query": {"match": {"content_field": user_query}},
                    "size": 5
                }

                mcp_response = await MCP_CLIENT.call_tool(tool_name, {"req": search_args})
                # print("강제 검색 결과:", type(mcp_response))
                # print(f"✅ 강제 검색 성공. 결과 수: {len(mcp_response.get('results', {}).get('hits', {}).get('hits', []))}")
                
        #         # 3-4. 2차 LLM 호출 (최종 답변 생성) - 기존 코드의 2차 호출 로직 사용
                # final_response_data = await second_ollama_call(user_query, mcp_response)
                # return final_response_data

            except Exception as e:
                print(">>> 강제 검색 오류", str(e))
                pass
            
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