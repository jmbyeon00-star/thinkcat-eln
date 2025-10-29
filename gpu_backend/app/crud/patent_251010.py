from typing import List, Dict, Any
from sqlalchemy import select, text
from sqlalchemy.orm import Session
import os

from app.models.patent_model import PatentData

DB_KEY_FIELD = os.getenv("DB_KEY_FIELD", "application_number")

def fetch_by_keys(session: Session, keys: List[str]) -> List[Dict[str, Any]]:
    if not keys:
        return []
    if DB_KEY_FIELD != "application_number":
        sql = text(f"""
            SELECT application_number, title, abstract, filing_date, grant_date, cpc_code, ipc_code, {DB_KEY_FIELD}
            FROM {PatentData.__tablename__}
            WHERE {DB_KEY_FIELD} IN :keys
        """)
        rows = session.execute(sql, {"keys": tuple(keys)}).mappings().all()
        return [dict(r) for r in rows]
    rows = session.execute(
        select(PatentData).where(getattr(PatentData, DB_KEY_FIELD).in_(keys))
    ).scalars().all()
    out = []
    for r in rows:
        out.append({
            "application_number": r.application_number,
            "title": r.title,
            "abstract": r.abstract,
            "filing_date": r.filing_date,#.isoformat() if r.filing_date else None,
            "grant_date": r.grant_date,
            "cpc_code": r.cpc_code.split('|')[0][:4],
            "ipc_code": r.ipc_code.split('|')[0][:4],
            DB_KEY_FIELD: getattr(r, DB_KEY_FIELD),
        })
    return out
