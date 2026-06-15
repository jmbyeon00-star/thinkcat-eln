"""사용자별 선행기술조사 히스토리 CRUD"""
import json
from datetime import datetime
from typing import List, Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.invalidation import InvalIdeaHistoryDB, InvalPriorArtReportDB, InvalPrepareCacheDB


def create_idea_history(
    db: Session,
    user_id: int,
    base_id: str,
    report_cache_key: str,
    model: str,
    idea_title: str,
    result: dict,
    prior_app_numbers: list,
    result_json: str = None,
) -> None:
    """선행기술조사 완료 후 유저 히스토리 저장. 실패해도 메인 흐름 유지."""
    if not user_id:
        return
    try:
        overall = result.get("report", {}).get("overall", {})
        summary_raw = overall.get("patentability_review", "")
        summary = summary_raw[:200] if summary_raw else ""
        db.add(InvalIdeaHistoryDB(
            user_id           = user_id,
            base_id           = base_id,
            report_cache_key  = report_cache_key,
            model             = model,
            idea_title        = idea_title or "",
            idea_summary      = summary,
            prior_app_numbers = json.dumps(prior_app_numbers, ensure_ascii=False),
            result_json       = result_json,
        ))
        db.commit()
        print(f"💾 선행기술조사 히스토리 저장: user={user_id}, key={report_cache_key}")
    except Exception as e:
        db.rollback()
        print(f"⚠️ 히스토리 저장 실패: {e}")


def update_idea_history_result(
    db: Session,
    history_id: int,
    user_id: int,
    result_json: str,
    prior_app_numbers: list,
) -> bool:
    """재생성 결과로 히스토리 row 덮어쓰기 (created_at 갱신)."""
    history = (
        db.query(InvalIdeaHistoryDB)
        .filter(
            InvalIdeaHistoryDB.id      == history_id,
            InvalIdeaHistoryDB.user_id == user_id,
        )
        .first()
    )
    if not history:
        return False
    try:
        result = json.loads(result_json)
        overall = result.get("report", {}).get("overall", {})
        summary_raw = overall.get("patentability_review", "")
        history.result_json       = result_json
        history.prior_app_numbers = json.dumps(prior_app_numbers, ensure_ascii=False)
        history.idea_summary      = summary_raw[:200] if summary_raw else ""
        history.created_at        = datetime.now(ZoneInfo("Asia/Seoul"))
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"⚠️ 히스토리 업데이트 실패: {e}")
        return False


def get_idea_history_list(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
) -> List[dict]:
    """유저의 선행기술조사 히스토리 목록 반환 (최신순)"""
    rows = (
        db.query(InvalIdeaHistoryDB)
        .filter(InvalIdeaHistoryDB.user_id == user_id)
        .order_by(InvalIdeaHistoryDB.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id":                 row.id,
            "idea_title":         row.idea_title or "",
            "idea_summary":       row.idea_summary or "",
            "prior_app_numbers":  json.loads(row.prior_app_numbers) if row.prior_app_numbers else [],
            "model":              row.model,
            "created_at":         row.created_at.isoformat() if row.created_at else None,
        }
        for row in rows
    ]


def get_idea_history_detail(
    db: Session,
    history_id: int,
    user_id: int,
) -> Optional[dict]:
    """히스토리 단건 조회 + 전체 보고서 결과 반환. 본인 것이 아니면 None."""
    history = (
        db.query(InvalIdeaHistoryDB)
        .filter(
            InvalIdeaHistoryDB.id      == history_id,
            InvalIdeaHistoryDB.user_id == user_id,
        )
        .first()
    )
    if not history:
        return None

    # result_json 스냅샷 우선 사용, 없으면 공유 캐시 폴백 (구버전 호환)
    if history.result_json:
        report = json.loads(history.result_json)
    else:
        cached = (
            db.query(InvalPriorArtReportDB)
            .filter(
                InvalPriorArtReportDB.base_id == history.report_cache_key,
                InvalPriorArtReportDB.model   == history.model,
            )
            .order_by(InvalPriorArtReportDB.created_at.desc())
            .first()
        )
        report = json.loads(cached.result_json) if cached else None

    # prepare 캐시에서 15건 전체 로드 (section 01 표시용)
    prepare_cache = (
        db.query(InvalPrepareCacheDB)
        .filter(InvalPrepareCacheDB.base_id == history.base_id)
        .first()
    )
    prior_patents = []
    if prepare_cache:
        prepare_data = json.loads(prepare_cache.result_json)
        prior_patents = prepare_data.get("prior_patents", [])

    return {
        "id":                history.id,
        "idea_title":        history.idea_title or "",
        "idea_summary":      history.idea_summary or "",
        "prior_app_numbers": json.loads(history.prior_app_numbers) if history.prior_app_numbers else [],
        "model":             history.model,
        "created_at":        history.created_at.isoformat() if history.created_at else None,
        "report":            report,
        "prior_patents":     prior_patents,
    }


def delete_idea_history(
    db: Session,
    history_id: int,
    user_id: int,
) -> bool:
    """히스토리 삭제. 본인 것이 아니면 False 반환."""
    history = (
        db.query(InvalIdeaHistoryDB)
        .filter(
            InvalIdeaHistoryDB.id      == history_id,
            InvalIdeaHistoryDB.user_id == user_id,
        )
        .first()
    )
    if not history:
        return False
    db.delete(history)
    db.commit()
    return True
