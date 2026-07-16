ㅇ"""특허 파서 - ipforce DB 조회 + GPU_BACKEND LLM 파싱
프롬프트는 GPU 백엔드에서 관리 (gpu_backend/app/core/llm/invalidation.py)
"""
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.config import settings
from app.models.patent_model import PatentResult


# ─────────────────────────────────
# ipforce DB 조회 (기존 세션 재사용)
# ─────────────────────────────────

def get_patent_info(app_number: str, db: Session) -> dict | None:
    row = db.query(PatentResult).filter(
        PatentResult.application_number == app_number
    ).first()
    if not row:
        return None
    return {
        "application_number": row.application_number,
        "title":              row.title,
        "filing_date":        row.filing_date,
        "applicant_name":     row.applicant_name,
        "inventor_name":      row.inventor_name,
        "ipc_code":           row.ipc_code,
        "abstract":           row.abstract,
        "end_status":         row.end_status,
        "family_application_number": row.family_application_number,
    }


def get_prior_patents_info(
    similar_ids: list[str],
    base_filing_date: str,
    db: Session,
    base_family_application_number: str | None = None,
    limit: int = 4,
):
    if not similar_ids:
        return []

    query = db.query(PatentResult).filter(
        PatentResult.application_number.in_(similar_ids),
        PatentResult.filing_date < base_filing_date,
    )

    if base_family_application_number:
        query = query.filter(
            or_(
                PatentResult.family_application_number.is_(None),
                PatentResult.family_application_number != base_family_application_number,
            )
        )

    rows = query.all()
    rows_by_id = {r.application_number: r for r in rows}
    ordered = [rows_by_id[sid] for sid in similar_ids if sid in rows_by_id][:limit]
    return [
        {
            "application_number": r.application_number,
            "title":              r.title,
            "filing_date":        r.filing_date,
            "applicant_name":     r.applicant_name,
            "inventor_name":      r.inventor_name,
            "ipc_code":           r.ipc_code,
            "abstract":           r.abstract,
        }
        for r in ordered
    ]


# ─────────────────────────────────
# 유사특허 API (gpu_backend)
# ─────────────────────────────────

def get_similar_patents(base_app_number: str, n: int = 100) -> list[str]:
    try:
        res = httpx.get(
            f"{settings.GPU_BACKEND_URL}/gpu/neo4j/similar",
            params={"appNumber": base_app_number, "n": n},
            timeout=30,
        )
        if res.status_code != 200:
            print(f"⚠️ 유사특허 API 오류: HTTP {res.status_code}")
            return []
        data = res.json()
        return [s for s in data.get("data", []) if s != base_app_number]
    except httpx.HTTPError as e:
        print(f"⚠️ 유사특허 API 요청 실패: {e}")
        return []
    except (KeyError, ValueError) as e:
        print(f"⚠️ 유사특허 API 응답 파싱 실패: {e}")
        return []


def get_claims(app_numbers: list[str]) -> dict:
    try:
        res = httpx.post(
            f"{settings.GPU_BACKEND_URL}/gpu/neo4j/claims",
            json={"app_numbers": app_numbers},
            timeout=60,
        )
        if res.status_code != 200:
            print(f"⚠️ 청구항 API 오류: HTTP {res.status_code}")
            return {}
        data = res.json()
    except httpx.HTTPError as e:
        print(f"⚠️ 청구항 API 요청 실패: {e}")
        return {}
    except ValueError as e:
        print(f"⚠️ 청구항 API 응답 파싱 실패: {e}")
        return {}

    claims_dict = {}
    for patent in data.get("data", []):
        claims_text = "\n".join([
            f"청구항 {c['claim_num']} ({'독립항' if c['is_independent'] else '종속항'}): {c['text']}"
            for c in patent.get("claims", [])
            if c.get("text", "").strip() != "삭제"
        ])
        claims_dict[patent["application_number"]] = claims_text
    return claims_dict


# ─────────────────────────────────
# GPU_BACKEND LLM 파싱 (프롬프트는 GPU 백엔드에서 관리)
# ─────────────────────────────────

def parse_base(patent_info: dict, claims_text: str, model: str = "claude") -> list[dict]:
    """기준특허 파싱 — GPU 백엔드에 원시 데이터 전달"""
    try:
        res = httpx.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/base",
            json={
                "patent_info": patent_info,
                "claims_text": claims_text,
                "model":       model,
            },
            timeout=300.0,
        )
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise RuntimeError(f"GPU_BACKEND 기준특허 파싱 실패: {e}")


def parse_prior(patent_info: dict, claims_text: str, base_elements: list, model: str = "claude") -> list[dict]:
    """선행발명 파싱 — GPU 백엔드에 원시 데이터 전달"""
    try:
        res = httpx.post(
            f"{settings.GPU_BACKEND_URL}/gpu/invalidation/parse/prior",
            json={
                "patent_info":   patent_info,
                "claims_text":   claims_text,
                "base_elements": [
                    {
                        "id":       e.element_key or "",
                        "name":     e.name,
                        "function": e.function or "",
                    }
                    for e in base_elements
                ],
                "model": model,
            },
            timeout=300.0,
        )
        res.raise_for_status()
        return res.json()
    except Exception as e:
        raise RuntimeError(f"GPU_BACKEND 선행발명 파싱 실패: {e}")
