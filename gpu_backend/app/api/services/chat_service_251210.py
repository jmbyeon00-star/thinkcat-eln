import os
import json
import traceback
import requests
import asyncio

from fastapi import HTTPException
from fastmcp import Client
from fastmcp.client.logging import LogMessage

from typing import Tuple, List, Dict, Optional, Optional, Any
from pymysql.connections import Connection
from pymysql.cursors import Cursor, DictCursor

from app.utils.db_connecter import db_connect
from app.utils.es_client import get_es

from dotenv import load_dotenv
load_dotenv()

# 환경 변수 설정
MCP_ENDPOINT = os.getenv("MCP_ENDPOINT", "http://192.168.1.116:9999/mcp")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_API_URL = os.getenv("OLLAMA_API_URL", "http://192.168.1.20:11434/api/generate")
SESSION_ID = os.getenv("SESSION_ID", "gemma_ollama_session")

ES_HOST = os.getenv("ES_HOST", None)
DB_HOST = os.getenv("DB_HOST", None)
DB_USER = os.getenv("DB_USER", None)
DB_PASS = os.getenv("DB_PASS", None)
DB_TYPE = os.getenv("DB_TYPE", None)

async def chat_with_ollama(payload: dict):
    user_query = payload.get('query', {})
    user_id = payload.get('user_id', None)

    # 1차 호출 (Decision Call)
    # 2차 호출 (Generation Call)

    # >>>
    # import re
    # if re.search(r'출원번호\s*[:]?\s*[\w\d-]+', user_query):
    #     is_forced_search = True
    search_keywords = ["출원번호", "특허", "검색", "조회", "find", "search"]
    is_forced_search = any(kw in user_query.lower() for kw in search_keywords)
    try:
        tool_name = "es-search"
        request_params = { 
            "index": "인덱스명", 
            "query": {"match": {"content_field": user_query}},
            "size": 5
        }

        mcp_response = await MCP_CLIENT.call_tool(tool_name, request_params)
        print(f"✅ 강제 검색 성공. 결과 수: {len(mcp_response.get('results', {}).get('hits', {}).get('hits', []))}")
        
        # 3-4. 2차 LLM 호출 (최종 답변 생성) - 기존 코드의 2차 호출 로직 사용
        final_response_data = await second_ollama_call(user_query, mcp_response)
        return final_response_data
        
    except Exception as e:
        return {"error": f"강제 Tool Execution Failed: {e}"}


    # <<<

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
            # print(">>> tool:", tool_schemas)

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
                print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!yes!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
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

            # print("Gemma가 일반 답변을 생성합니다.")
            # print("\n--- 최종 결과 ---")
            # print(json.dumps({"status": "success", "response": llm_response_text}, indent=4, ensure_ascii=False))
            # print("llm_response_text:", llm_response_text)
            
            return {"status": "success", "response": llm_response_text}

    # 'async with' 블록 외부의 Exception 처리
    except requests.exceptions.RequestException as e:
        return {"error": f"Ollama API 호출 실패: {e}"}
    except Exception as e:
        print(f"경고: MCP 서버 연결 또는 설정 실패. 오류: {e}")
        # MCP 클라이언트 초기화 실패 또는 연결 실패 시
        return {"error": f"MCP Client Connection Failed: {e}"}
