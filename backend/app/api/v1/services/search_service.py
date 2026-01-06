from fastapi import HTTPException
from app.crud.patent import (
    fetch_by_keys,
    fetch_patent_by_appnum,
    fetch_patent_by_regnum,
)
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session

import os
import requests
import traceback

GPU_SERVER_URL = os.getenv("GPU_SERVER_URL", "http://125.141.113.2:7001")

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
        response = requests.post(f"{GPU_SERVER_URL}/gpu/search/keyword", params=payload, timeout=30)

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