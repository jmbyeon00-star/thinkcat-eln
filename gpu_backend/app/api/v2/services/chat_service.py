import os
import re
import json
import traceback
import requests
import asyncio
import httpx

from fastapi import HTTPException
from fastmcp import Client
from fastmcp.client.logging import LogMessage

from typing import Tuple, List, Dict, Optional, Optional, Any
from pymysql.connections import Connection
from pymysql.cursors import Cursor, DictCursor

from app.utils.db_connecter import db_connect
from app.utils.es_client import get_es
from app.utils.embedding import get_embedding

# LangChain 모듈
# from langchain_core.prompts import ChatPromptTemplate
# from langchain_openai import ChatOpenAI

# 출력 구조 정의를 위한 Pydantic
# from pydantic import BaseModel, Field

# from typing import Literal
from dotenv import load_dotenv
load_dotenv()

# 환경 변수 설정
MCP_ENDPOINT = os.getenv("MCP_ENDPOINT", "http://192.168.1.116:9999/mcp")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://192.168.1.20:11434")
SESSION_ID = os.getenv("SESSION_ID", "gemma_ollama_session")

ES_HOST = os.getenv("ES_HOST", None)
DB_HOST = os.getenv("DB_HOST", None)
DB_USER = os.getenv("DB_USER", None)
DB_PASS = os.getenv("DB_PASS", None)
DB_TYPE = os.getenv("DB_TYPE", None)

async def chat_with_ollama(payload: dict):
    user_query = payload.get('query', {})
    user_id = payload.get('user_id', None)

    SYSTEM_PROMPT = """
너는 시스템 라우터다.
사용자 질문에 대해 반드시 아래 action 중 하나만 선택하라.

[action 목록]
- direct : LLM이 바로 답변 가능
- search : 외부 검색 필요
- db     : 내부 DB 조회 필요
- tool   : 도구 실행 필요

⚠️ 절대 답변을 생성하지 말고
⚠️ 반드시 JSON 형식으로만 응답하라.
"""
    DECISION_PROMPT = f"""
질문:
{user_query}

다음 JSON 형식으로 응답하라:

{{
  "action": "direct | search | db | tool",
  "confidence": 0.0,
  "reason": "한 줄 판단 근거"
}}
"""
    ollama_payload = {
        "model": OLLAMA_MODEL,
        "prompt": DECISION_PROMPT,
        "options": {
            # "system": f"You are a helpful assistant. You have access to the following tools: {tools_str}. Use the tools to answer the question if necessary.",
            "system": SYSTEM_PROMPT 
        },
        "stream": False 
    }
            
    def parse_llm_json(text: str) -> dict:
        # ```json ... ``` 또는 ``` ... ``` 제거
        cleaned = re.sub(r"```(?:json)?\s*", "", text)
        cleaned = re.sub(r"\s*```", "", cleaned)
        return json.loads(cleaned)

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            ollama_res = await client.post(OLLAMA_BASE_URL+"/api/generate", json=ollama_payload)
            ollama_res.raise_for_status()
            
            # Ollama의 응답 텍스트 추출
            llm_text_response = ollama_res.json().get("response", "").strip()
            decision = parse_llm_json(llm_text_response)
            print(decision)

        except httpx.HTTPStatusError as e:
            print(f"Ollama 서버 오류 발생: {e.response.status_code}")
            return {"role": "assistant", "content": f"AI 서버 오류가 발생했습니다: {e.response.text}"}
        except Exception as e:
            print(f"Ollama 통신 오류: {e}")
            return {"role": "assistant", "content": f"AI 서버 통신 오류가 발생했습니다: {e}"}
    
    if decision["action"] == "direct":
        try:
            print("Direct!")

            ollama_payload = {
                "model": OLLAMA_MODEL,
                "prompt": user_query,
                "options": {
                    "system": "You are a helpful and friendly assistant."
                },
                "stream": False 
            }

            response = requests.post(OLLAMA_BASE_URL+"/api/generate", json=ollama_payload)
            
            response.raise_for_status()
            ollama_output = response.json()
            llm_response_text = ollama_output.get("response", "").strip()

            return {"status": "success", "response": llm_response_text}
        except Exception as e:
            print("direct 요청 에러:", str(e))
            return {"role": "assistant", "content": f"AI 서버 통신 오류가 발생했습니다: {e}"}

    elif decision["action"] == "search":
        print("Seach!")
        try:
            # 1. FastMCP 클라이언트 초기화 및 연결
            MCP_CLIENT = Client(MCP_ENDPOINT)

            async with MCP_CLIENT:
                ping_result = await MCP_CLIENT.call_tool("es-ping", {"req": {}})
                # print(f"DEBUG: ES-PING RAW RESULT: {ping_result}")

                # if ping_result.get("success"):
                if ping_result.data.get("success"):
                    print()
                    # print("✅ MCP 서버와 Elasticsearch 연결 성공.")
                else:
                    error_message = ping_result.get('error', 'Unknown ES failure')
                    # print(f"❌ MCP 연결 성공, ES 핑 실패: {error_message}")
                    raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

                # 2. 도구 스키마 로드
                tool_objects = await MCP_CLIENT.list_tools()
                tool_schemas = [
                    tool.model_dump() 
                    for tool in tool_objects
                ]
                tools_str = json.dumps(tool_schemas)
                # print(f"📦 MCP 서버에서 {len(tool_schemas)}개의 도구 스키마 로드 완료.")

                # 1차 호출 (Decision Call)

                # >>>
                search_keywords = ["출원번호", "특허", "검색", "조회", "find", "search"]
                # is_forced_search = any(kw in user_query.lower() for kw in search_keywords)
                is_forced_search = "일반" not in user_query
                # import re
                # if re.search(r'출원번호\s*[:]?\s*[\w\d-]+', user_query):
                #     is_forced_search = True
                if is_forced_search:
                    # 강제 2차 호출 (Generation Call)
                    tool_name = "es-search"
                    index = "titleabstract_h"
                    embedded_query = get_embedding(user_query)
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
                    # print(">>> query_dsl:", query_dsl)
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
                        # return {"error": f"강제 Tool Execution Failed: {e}"}
                # <<<

                # print("\n--- 최종 결과 ---")
                # print(json.dumps({"status": "success", "response": llm_response_text}, indent=4, ensure_ascii=False))
                # print("llm_response_text:", llm_response_text)
                
                if is_forced_search:
                    raw = json.loads(mcp_response.content[0].text)
                    print("\n\n\n", raw)
                    formatted_resources = format_search_results(mcp_response)
                    # return {"status": "success", "response": formatted_resources}
                    print("\n\n\n", formatted_resources)

                    result = generation_call(user_query, formatted_resources, "http://192.168.1.20:11434")
                    result.update({"status": "success", "summary": formatted_resources, "mcp_response": raw})
                    # print("\n\n\n\n\n", result, "\n\n\n\n\n")
                    print("\n\n\n", result)
                    return result
                    
                    return {"status": "success", "response": raw}

        # 'async with' 블록 외부의 Exception 처리
        except requests.exceptions.RequestException as e:
            return {"error": f"Ollama API 호출 실패: {e}"}
        except Exception as e:
            print(f"경고: MCP 서버 연결 또는 설정 실패. 오류: {e}")
            # MCP 클라이언트 초기화 실패 또는 연결 실패 시
            return {"error": f"MCP Client Connection Failed: {e}"}



from fastapi.responses import StreamingResponse
from app.core.llm.decision import decision_call
from app.core.llm.generate import stream_generate_text

async def chat_stream_with_ollama(payload: dict):
    user_query = payload.get('query', {})
    user_id = payload.get('user_id', None)

    async def event_stream():
        # 🔥 첫 패킷 (중요)
        yield "data: [GPU_CONNECTED]\n\n"

        decision = await decision_call(user_query)
        yield f"data: [DECISION:{decision.action}]\n\n"

        if decision.action == "direct":
            async for token in stream_generate_text(prompt=user_query):
                yield f"data: {token}\n\n"
                await asyncio.sleep(0)

        else:
            yield "data: 현재 search 스트림 미구현\n\n"

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
    )

    # # 1️⃣ Decision
    # decision = await decision_call(user_query)
    # # logger.info(f"[DECISION] {decision}")
    # print("[DECISION]", decision)

    # if decision.action == "direct":
    #     async def event_stream():
    #         async for token in stream_generate_text(prompt=user_query):
    #             yield f"data: {token}\n\n"

    #     return StreamingResponse(
    #         event_stream(),
    #         media_type="text/event-stream",
    #     )
    # # elif decision.action == "search":
    #     # return await es_search(user_query)

    #     # return {
    #     #     "status": "success",
    #     #     "decision": decision.model_dump(),
    #     #     "message": "Non-direct action not implemented yet",
    #     # }

    # try:
    #     # 1. FastMCP 클라이언트 초기화 및 연결
    #     MCP_CLIENT = Client(MCP_ENDPOINT)
    #     async with MCP_CLIENT:
    #         ping_result = await MCP_CLIENT.call_tool("es-ping", {"req": {}})
    #         # print(f"DEBUG: ES-PING RAW RESULT: {ping_result}")

    #         # if ping_result.get("success"):
    #         if ping_result.data.get("success"):
    #             print()
    #             # print("✅ MCP 서버와 Elasticsearch 연결 성공.")
    #         else:
    #             error_message = ping_result.get('error', 'Unknown ES failure')
    #             # print(f"❌ MCP 연결 성공, ES 핑 실패: {error_message}")
    #             raise ConnectionError(f"Elasticsearch 핑 실패: {error_message}")

    #         # 2. 도구 스키마 로드
    #         tool_objects = await MCP_CLIENT.list_tools()
    #         tool_schemas = [
    #             tool.model_dump() 
    #             for tool in tool_objects
    #         ]
    #         tools_str = json.dumps(tool_schemas)
    #         # print(f"MCP 서버에서 {len(tool_schemas)}개의 도구 스키마 로드 완료.")
    #         print(f"도구 스키마 목록 {tool_schemas}")

            
    #         return {"status": "success", "response": decision}
    #         # from app.core.llm.client import OllamaClient
    #         # print("api/generat:", OLLAMA_BASE_URL)
    #         # ollama = OllamaClient(
    #         #     base_url=OLLAMA_BASE_URL,
    #         #     model=OLLAMA_MODEL,
    #         # )

    #         # response = await ollama.generate(
    #         #     prompt="안녕",
    #         # )

    #         # print(response)
            
          
    #         # >>>
            
    #         if decision.action == "search":
    #             # 강제 2차 호출 (Generation Call)
    #             tool_name = "es-search"
    #             index = "titleabstract_h"
    #             embedded_query = get_embedding(user_query)
    #             # print("embedded_query:", embedded_query)

    #             MAPPING_PROPS = {
    #                 "address": {"type": "long"}, 
    #                 "quote": {"type": "text"}, 
    #                 "vector": {"dims": 1024, "type": "dense_vector"}
    #             }
                
    #             from .search_service import _build_query
    #             query_dsl = _build_query(
    #                 index=index,
    #                 props=MAPPING_PROPS,
    #                 keyword=user_query,
    #                 use_vector=True,
    #                 get_embedding_fn=get_embedding # BGEM3 임베딩 함수
    #             )
    #             # print(">>> query_dsl:", query_dsl)
    #             search_args = {
    #                 "index": index, 
    #                 "track_total_hits": True,
    #                 "from": 0,
    #                 "size": 5,
    #                 "_source": ["address", "quote"],
    #                 "query": query_dsl, # 생성된 하이브리드 DSL (ID, term, vector script_score 포함)
    #                 "highlight": {
    #                     "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
    #                     "fields": {"quote": {}}
    #                 }
    #             }
    #             try:
    #                 request_params = { 
    #                     "index": "titleabstract_h", 
    #                     "query": {"match": {"content_field": user_query}},
    #                     "size": 5
    #                 }

    #                 mcp_response = await MCP_CLIENT.call_tool(tool_name, {"req": search_args})
    #                 # print("강제 검색 결과:", type(mcp_response))
    #                 # print(f"✅ 강제 검색 성공. 결과 수: {len(mcp_response.get('results', {}).get('hits', {}).get('hits', []))}")
                    
    #         #         # 3-4. 2차 LLM 호출 (최종 답변 생성) - 기존 코드의 2차 호출 로직 사용
    #                 # final_response_data = await second_ollama_call(user_query, mcp_response)
    #                 # return final_response_data

    #             except Exception as e:
    #                 print(">>> 강제 검색 오류", str(e))
    #                 pass
    #                 # return {"error": f"강제 Tool Execution Failed: {e}"}

          
    #             raw = json.loads(mcp_response.content[0].text)
    #             print("\n\n\n", raw)
    #             formatted_resources = format_search_results(mcp_response)
    #             # return {"status": "success", "response": formatted_resources}
    #             print("\n\n\n", formatted_resources)

    #             result = generation_call(user_query, formatted_resources, "http://192.168.1.20:11434")
    #             result.update({"status": "success", "summary": formatted_resources, "mcp_response": raw})
    #             # print("\n\n\n\n\n", result, "\n\n\n\n\n")
    #             print("\n\n\n", result)
    #             return result
                
    #             return {"status": "success", "response": raw}
    #             # <<<

    #         else:
    #             ollama_payload = {
    #                 "model": OLLAMA_MODEL,
    #                 "prompt": user_query,
    #                 "options": {
    #                     "system": f"You are a helpful assistant. You have access to the following tools: {tools_str}. Use the tools to answer the question if necessary.",
    #                 },
    #                 "stream": False 
    #             }

    #             response = requests.post(OLLAMA_BASE_URL, json=ollama_payload)
                
    #             response.raise_for_status()
    #             ollama_output = response.json()
    #             llm_response_text = ollama_output.get("response", "").strip()
    #             print(">>>>>", llm_response_text)
    #             return {"status": "success", "response": llm_response_text}

    # # 'async with' 블록 외부의 Exception 처리
    # except requests.exceptions.RequestException as e:
    #     return {"error": f"Ollama API 호출 실패: {e}"}
    # except Exception as e:
    #     print(f"경고: MCP 서버 연결 또는 설정 실패. 오류: {e}")
    #     # MCP 클라이언트 초기화 실패 또는 연결 실패 시
    #     return {"error": f"MCP Client Connection Failed: {e}"}

def format_search_results(mcp_response):
    """MCP 응답에서 ES 검색 결과를 추출하여 LLM 프롬프트용 문자열로 포맷"""
    
    # .data 속성에 접근하여 ES 검색 결과 딕셔너리를 추출
    raw_data = mcp_response.data
    es_results = raw_data.get("results", {})
    
    # 'hits' 목록 가져오기
    hits = es_results.get("hits", {}).get("hits", [])
    
    if not hits:
        return "검색 결과가 없습니다. 일반 지식으로 답변하세요."
    
    formatted_results = []
    
    for i, hit in enumerate(hits):
        source = hit.get('_source', {})
        # address (출원번호)와 quote (텍스트 내용)만 추출
        doc_info = {
            "ID": source.get("address", "N/A"),
            "CONTENT": source.get("quote", "N/A"),
            "SCORE": hit.get('_score', 'N/A')
        }
        # highlight된 결과가 있으면 그것을 우선 사용 (더 관련성 높음)
        highlighted_quote = hit.get('highlight', {}).get('quote', [doc_info['CONTENT']])
        
        # LLM에게는 highlight 태그를 제거하고 전달하는 것이 좋습니다.
        clean_content = "\n".join(highlighted_quote).replace("<mark>", "").replace("</mark>", "")
        
        formatted_results.append(f"--- 자료 {i+1} (점수: {doc_info['SCORE']}): ID:{doc_info['ID']} ---\n{clean_content}")
        
    return "\n\n".join(formatted_results)

def generation_call(user_query: str, formatted_resources, OLLAMA_HOST: str):
    
    # 1. 검색 결과 포맷팅
    # formatted_resources = format_search_results(mcp_response)
    
    # 2. RAG 시스템 프롬프트 구성
    RAG_SYSTEM_PROMPT = f"""
    당신은 전문 특허 검색 및 분석 어시스턴트입니다.
    사용자의 질문에 대해 당신이 검색한 아래 '검색 자료'를 근거로 답변해야 합니다.
    답변은 자료의 내용을 바탕으로 상세하고 정확해야 하며, 자료에 없는 내용은 추측하지 마세요.
    
    --- 검색 자료 ---
    {formatted_resources}
    ---
    
    위 자료를 바탕으로 사용자의 질문에 정확하고 간결하게 답변하세요.
    """

    OLLAMA_MODEL = "gemma3:4b"
    OLLAMA_ENDPOINT = f"{OLLAMA_HOST}/api/generate" 
    
    # 3. Payload 구성
    ollama_payload = {
        "model": OLLAMA_MODEL,
        "prompt": user_query,
        "options": {
            "system": RAG_SYSTEM_PROMPT, 
            "temperature": 0.1 # 사실 기반 답변을 위해 낮은 온도 유지
        },
        "stream": False 
    }

    # 4. Ollama API 호출 및 결과 반환
    try:
        # 비동기 환경에 맞게 aiohttp 또는 httpx 사용을 권장하지만, 예시에서는 requests 사용
        response = requests.post(OLLAMA_ENDPOINT, json=ollama_payload)
        response.raise_for_status()
        
        final_response_json = response.json()
        final_text = final_response_json.get('response', 'Gemma 모델이 답변을 생성하지 못했습니다.')
        
        return {"response": final_text, "source": formatted_resources}

    except requests.exceptions.RequestException as e:
        return {"error": f"Gemma API 호출 오류: {e}"}