from sqlalchemy.orm import Session
from sqlalchemy import or_, func, distinct
from app.models.collection_model import CollectionInfo
from app.models.project_model import ProjectData, ProjectInfo

from sqlalchemy import or_, distinct
from sqlalchemy.orm import Session
from app.models.collection_model import CollectionInfo
from app.models.project_model import ProjectData, ProjectInfo

def get_collections(session: Session, user_id: int, page: int = 1, limit: int = 10, q: str | None = None):
    query = session.query(CollectionInfo).filter(CollectionInfo.user_id == user_id)

    if q:
        query = query.filter(
            or_(
                CollectionInfo.collection_name.ilike(f"%{q}%"),
                CollectionInfo.collection_code.ilike(f"%{q}%"),
                CollectionInfo.collection_category.ilike(f"%{q}%"),
            )
        )

    total = query.count()
    items = (
        query.order_by(CollectionInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    result = []
    for c in items:
        # ✅ project_names (JOIN)
        project_names = (
            session.query(distinct(ProjectInfo.project_name))
            .join(ProjectData, ProjectInfo.id == ProjectData.project_id)
            .filter(ProjectInfo.user_id == user_id)
            .filter(ProjectData.collection_name == c.collection_name)
            .all()
        )
        project_names = [p[0] for p in project_names if p[0]]

        # ✅ data_count (ProjectData 내 같은 collection_name의 데이터 수)
        data_count = (
            session.query(func.count(ProjectData.id))
            .filter(ProjectData.user_id == user_id)
            .filter(ProjectData.collection_name == c.collection_name)
            .scalar()
        )

        result.append({
            **to_dict_safe(c),
            "project_names": project_names,
            "data_count": data_count,
        })

    return {
        "items": result,
        "total": total,
        "page": page,
        "limit": limit,
    }

def get_collection_detail(
    session: Session,
    collection_id: int,
    page: int = 1,
    limit: int = 10,
    q: str | None = None,
):
    """
    ✅ 컬렉션 상세 조회 (해당 컬렉션이 가진 데이터 목록 + 페이지네이션)
    """
    # 1️⃣ 컬렉션 기본 정보 조회
    collection = session.query(CollectionInfo).filter(CollectionInfo.id == collection_id).first()
    if not collection:
        return {"error": "Collection not found"}

    # 2️⃣ 데이터 필터링 기본 쿼리
    query = session.query(ProjectData).filter(ProjectData.collection_name == collection.collection_name)

    # 3️⃣ 검색어 필터 (옵션)
    if q:
        query = query.filter(
            or_(
                ProjectData.title.ilike(f"%{q}%"),
                ProjectData.abstract.ilike(f"%{q}%"),
                ProjectData.application_number.ilike(f"%{q}%"),
            )
        )

    # 4️⃣ 전체 개수 및 페이징
    total = query.count()
    data_list = (
        query.order_by(ProjectData.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # 5️⃣ 결과 반환
    return {
        "collection": to_dict_safe(collection),
        "items": [to_dict_data(d) for d in data_list],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,  # 올림 계산
    }


# 안전한 dict 변환 (to_dict 없는 모델 대응)
def to_dict_safe(obj):
    return {
        "id": obj.id,
        "collection_name": getattr(obj, "collection_name", None),
        "collection_code": getattr(obj, "collection_code", None),
        "collection_category": getattr(obj, "collection_category", None),
        "project_name": getattr(obj, "project_name", None),
        "source_type": getattr(obj, "source_type", None),
        "mean_vector": getattr(obj, "mean_vector", None),
        "created_datetime": getattr(obj, "created_datetime", None),
    }

def to_dict_data(d):
    return {
        "id": d.id,
        "project_id": getattr(d, "project_id", None),
        "collection_name": getattr(d, "collection_name", None),
        "title": getattr(d, "title", None),
        "abstract": getattr(d, "abstract", None),
        "applicant_name": getattr(d, "applicant_name", None),
        "application_number": getattr(d, "application_number", None),
        "application_date": getattr(d, "application_date", None),
    }


def get_collections_by_project_id(session, user_id, project_id):
    collection_info = session.query(CollectionInfo).filter(
        CollectionInfo.project_id == project_id, 
        CollectionInfo.user_id == user_id
    ).all()

    collection_ids = []
    collection_codes = []
    collection_names = []
    for item in collection_info:
        collection_ids.append(item.id)
        collection_codes.append(item.collection_code)
        collection_names.append(item.collection_name)

    if not collection_info:
        return {"error": "Collection not found"}

    return {
        "collection_ids": collection_ids,
        "collection_codes": collection_codes,
        "collection_names": collection_names
    }