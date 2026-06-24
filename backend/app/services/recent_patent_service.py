from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.sdi_new_patent import SdiNewPatent


def get_recent_patents(
    db_session: Session, limit: int = 20, section: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    홈 화면 신착특허 티커용 - 공개일자 최신순으로 N건 반환.
    클릭 시 모달에 그대로 보여줄 수 있도록 테이블에 있는 정보를 전부 포함한다.

    section: IPC 섹션(A~H) 한 글자. ipc_code는 "메인코드|서브코드|..." 형태로 저장되어
    있어, 메인코드가 항상 맨 앞에 오므로 LIKE 'X%'로 해당 섹션만 걸러낼 수 있다.
    """
    query = db_session.query(SdiNewPatent)
    if section:
        query = query.filter(SdiNewPatent.ipc_code.like(f"{section.upper()}%"))

    rows = (
        query
        .order_by(SdiNewPatent.open_date.desc(), SdiNewPatent.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "application_number": r.application_number,
            "publication_number": r.publication_number,
            "open_date": r.open_date,
            "filing_date": r.filing_date,
            "title": r.title,
            "abstract": r.abstract,
            "ipc_code": r.ipc_code,
            "applicant_name": r.applicant_name,
            "end_status": r.end_status,
        }
        for r in rows
    ]
