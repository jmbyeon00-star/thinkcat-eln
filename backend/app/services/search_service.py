from fastapi import HTTPException
from app.crud.patent import (
    fetch_patent_by_appnum,
    fetch_patent_by_regnum,
    fetch_by_applicant
)
from typing import Tuple, List, Dict, Optional, Any
from sqlalchemy.orm import Session

import os
import httpx
import requests
import traceback

from dotenv import load_dotenv
import os
import traceback

load_dotenv()
GPU_SERVER_URL = os.getenv("GPU_SERVER_URL", "http://125.141.113.2:7001")
GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://125.141.113.2:7001")

def search_by_keyword(section: str, keyword: str, page: int, page_size: int, method: str, include_vector: bool, include_quote: bool) -> Dict:
    try:
        payload = {
            "section": section,
            "keyword": keyword,
            "method": method,
            "include_vector": include_vector,
            "include_quote": include_quote,
            "page": page,
            "page_size": page_size
        }
        # GPU 서버로 POST 요청
        response = requests.post(f"{GPU_BACKEND_URL}/gpu/search/keyword", params=payload, timeout=30)

        if response.status_code != 200:
            raise Exception(f"GPU 서버 요청 실패: {response.status_code}")# {response.text}")

        return response.json()

    except Exception as e:
        raise Exception(f"GPU 서버 통신 오류: {e}")


# ------------------------------------------
# 📄 출원번호 검색
# ------------------------------------------
def search_by_application(session: Session, app_num: str) -> Dict:
    return fetch_patent_by_appnum(session, app_num) or {}

# ------------------------------------------
# 🧾 등록번호 검색
# ------------------------------------------
def search_by_registration(session: Session, reg_num: str) -> Dict:
    return fetch_patent_by_regnum(session, reg_num) or {}

# ------------------------------------------
# 🏢 출원인코드 검색
# ------------------------------------------
def search_fetch_by_applicant(session: Session, applicant_code: str) -> Dict:
    return fetch_by_applicant(session, applicant_code) or {}

async def search_standard(session: Session, user_id: Optional[int], body: str) -> Dict[str, Any]:
    payload = {
        "user_id": user_id,
        "body": body
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/search/standard", 
                json=payload,
                timeout=30
            )
            
            resp.raise_for_status() 
            gpu_result = resp.json()
            return gpu_result

    except httpx.HTTPStatusError as e:
        error_detail = f"GPU 서버에서 HTTP 오류 발생: {e.response.status_code} - {e.response.text[:100]}..."
        print(error_detail)
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 오류: {e.response.status_code}") from e
        
    except Exception as e:
        error_detail = str(e)
        print(f"GPU 서버 통신 오류: {error_detail}")
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 통신 실패: {error_detail}") from e

async def search_with_mcp(session: Session, user_id: Optional[int], body: str) -> Dict[str, Any]:
    """
    GPU 서버로 LLM 기반 검색 요청을 전달하고 최종 검색 결과를 받아 반환합니다.
    """
    
    payload = {
        "user_id": user_id,
        "body": body
    }
    
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/search/mcp", 
                json=payload,
                timeout=45.0 # LLM 추론 시간과 ES 검색 시간을 고려하여 30초보다 길게 설정 권장
            )
            
            # HTTP 오류 상태 코드(4xx, 5xx)가 발생하면 예외를 발생시킵니다.
            resp.raise_for_status() 
            
            # GPU 서버로부터 받은 최종 JSON 응답 (summary와 results 포함)
            gpu_result = resp.json()
            
            # Pydantic 모델(PatentDetailResponse)에 맞는지 확인 후 반환
            # FastAPI가 라우터에서 response_model을 통해 최종 검증을 수행합니다.
            return gpu_result

    except httpx.HTTPStatusError as e:
        # GPU 서버에서 4xx, 5xx 오류를 반환했을 때
        error_detail = f"GPU 서버에서 HTTP 오류 발생: {e.response.status_code} - {e.response.text[:100]}..."
        print(error_detail)
        # 503 Service Unavailable (외부 서비스 오류)로 클라이언트에게 반환
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 오류: {e.response.status_code}") from e
        
    except Exception as e:
        # 연결 시간 초과, DNS 오류 등 네트워크 문제
        error_detail = str(e)
        print(f"GPU 서버 통신 오류: {error_detail}")
        # 503 Service Unavailable 로 클라이언트에게 반환
        raise HTTPException(status_code=503, detail=f"GPU LLM 서버 통신 실패: {error_detail}") from e


async def search_similar(session: Session, user_id: Optional[int], body: Dict[str, Any]) -> Dict[str, Any]:
    """
    선택한 특허들을 기반으로 유사 특허를 검색합니다.

    Args:
        body: {
            method: 'centroid' | 'script_score' | 'weighted',
            patents: [{title, abstract, application_number}, ...],
            exclude_app_numbers: [출원번호 목록],
            size: 결과 수
        }
    """
    payload = {
        "user_id": user_id,
        "body": body
    }

    print(f"유사 검색 요청 payload: {payload}")

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/search/similar",
                json=payload,
                timeout=60.0  # 여러 임베딩 처리 시간 고려
            )

            resp.raise_for_status()
            gpu_result = resp.json()
            return gpu_result

    except httpx.HTTPStatusError as e:
        error_detail = f"GPU 서버에서 HTTP 오류 발생: {e.response.status_code} - {e.response.text[:100]}..."
        print(error_detail)
        raise HTTPException(status_code=503, detail=f"GPU 서버 오류: {e.response.status_code}") from e

    except Exception as e:
        error_detail = str(e)
        print(f"GPU 서버 통신 오류: {error_detail}")
        raise HTTPException(status_code=503, detail=f"GPU 서버 통신 실패: {error_detail}") from e

async def fetch_vectors_from_gpu(app_nums: List[str]) -> Dict[str, List[float]]:
    """
    GPU 백엔드 서버에 출원번호 목록을 보내 벡터값을 보완합니다.
    """
    if not app_nums:
        return {}
    
    payload = {"app_nums": app_nums}
    print(f"Vector 요청 payload: {payload}")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{GPU_BACKEND_URL}/gpu/search/vectors",
                json=payload,
                timeout=30.0
            )
            resp.raise_for_status()
            return resp.json()
            
    except Exception as e:
        print(f"❌ Error in fetch_vectors_from_gpu: {e}")
        # 오류 발생 시 빈 결과 반환하여 메인 프로세스 진행 보존
        return {}