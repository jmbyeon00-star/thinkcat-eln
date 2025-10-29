from typing import List, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.orm import Session
import os

from app.models.patent_model import PatentData

# 환경 변수로 키 필드 커스터마이징 가능
DB_KEY_FIELD = os.getenv("DB_KEY_FIELD", "application_number")


# ------------------------------------------
# ✅ 여러 건 조회 (Elasticsearch 결과 병합용)
# ------------------------------------------
def fetch_by_keys(session: Session, keys: List[str]) -> List[Dict[str, Any]]:
    if not keys:
        return []

    # 다른 키 필드로 검색해야 하는 경우 (예: reg_number)
    if DB_KEY_FIELD != "application_number":
        sql = text(f"""
            SELECT application_number, title, abstract, filing_date, grant_date, cpc_code, ipc_code, {DB_KEY_FIELD}
            FROM {PatentData.__tablename__}
            WHERE {DB_KEY_FIELD} IN :keys
        """)
        rows = session.execute(sql, {"keys": tuple(keys)}).mappings().all()
        return [dict(r) for r in rows]

    # 기본은 application_number 기준 ORM 쿼리
    rows = session.execute(
        select(PatentData).where(getattr(PatentData, DB_KEY_FIELD).in_(keys))
    ).scalars().all()

    out = []
    for r in rows:
        out.append({
            "application_number": r.application_number,
            "title": r.title,
            "abstract": r.abstract,
            "filing_date": r.filing_date,
            "grant_date": r.grant_date,
            "cpc_code": (r.cpc_code or "").split('|')[0][:4],
            "ipc_code": (r.ipc_code or "").split('|')[0][:4],
            DB_KEY_FIELD: getattr(r, DB_KEY_FIELD),
        })
    return out


# ------------------------------------------
# 📄 단건 조회 — 출원번호(application_number) 기반
# ------------------------------------------
def fetch_patent_by_appnum(session: Session, app_num: str) -> Dict[str, Any]:
    row = session.execute(
        select(PatentData).where(PatentData.application_number == app_num)
    ).scalar_one_or_none()

    if not row:
        return {}

    return {
        "application_number": row.application_number,
        "title": row.title,
        "abstract": row.abstract,
        "filing_date": row.filing_date,
        "grant_date": row.grant_date,
        "cpc_code": (row.cpc_code or "").split('|')[0][:4],
        "ipc_code": (row.ipc_code or "").split('|')[0][:4],
    }


# ------------------------------------------
# 🧾 단건 조회 — 등록번호(reg_number) 기반
# ------------------------------------------
def fetch_patent_by_regnum(session: Session, reg_num: str) -> Dict[str, Any]:
    row = session.execute(
        select(PatentData).where(PatentData.reg_number == reg_num)
    ).scalar_one_or_none()

    if not row:
        return {}

    return {
        "reg_number": row.reg_number,
        "application_number": row.application_number,
        "title": row.title,
        "abstract": row.abstract,
        "filing_date": row.filing_date,
        "grant_date": row.grant_date,
        "cpc_code": (row.cpc_code or "").split('|')[0][:4],
        "ipc_code": (row.ipc_code or "").split('|')[0][:4],
    }
