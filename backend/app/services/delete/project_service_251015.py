# app/services/project_service.py
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.project_model import ProjectInfo, ProjectData
from app.schemas.project_schema import ProjectCreate
from app.models.collection_model import CollectionInfo

from collections import defaultdict
from datetime import datetime
import uuid
import numpy as np

def create_project(req: ProjectCreate, session: Session, user_id: int) -> ProjectInfo:
    # project_code = "PRJ-" + secrets.token_hex(4).upper()
    project_code = "PRJ-" + str(uuid.uuid4())[:8]

    project = ProjectInfo(
        user_id=user_id,
        project_code=project_code,
        project_name=req.project_name,
        project_description=req.project_description,
        source_type=req.source_type,
        task_type=req.task_type
    )
    project.project_status = 0
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return project

# def list_projects(session: Session):
#     return session.query(ProjectInfo).all()
def get_projects(session: Session, page: int = 1, limit: int = 10, q: str | None = None):
    query = session.query(ProjectInfo)

    if q:
        query = query.filter(
            or_(
                ProjectInfo.project_name.ilike(f"%{q}%"),
                ProjectInfo.project_description.ilike(f"%{q}%"),
                ProjectInfo.task_type.ilike(f"%{q}%"),
            )
        )

    total = query.count()
    items = (
        query.order_by(ProjectInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
    }

def get_project(project_id: int, session: Session):
    return session.query(ProjectInfo).get(project_id)

def insert_project_data(session: Session, user_id: int, project_id: int, body: dict):
    existing_count = session.query(ProjectData).filter_by(project_id=project_id).count()

    source_type = body.get("source_type", '')
    project_code = body.get("project_code", '')
    project_name = body.get("project_name", '')
    project_desc = body.get("project_desc", [])

    app_nums = body.get("application_numbers", None)
    col_names = body.get("collection_name", [])
    titles = body.get("title", [])
    abstracts = body.get("abstract", [])
    vectors = body.get("vector", [])

    n_app_nums = body.get("n_application_number", None)
    n_col_names = body.get("n_collection_name", '')
    n_titles = body.get("n_title", [])
    n_abstracts = body.get("n_abstract", [])
    n_vectors = body.get("n_vector", [])

    if not app_nums:
        return {"inserted": 0, "skipped": 0}
    
    grouped = defaultdict(list)
    for app, label, vec in zip(app_nums, col_names, vectors):
        grouped[label].append((app, vec))

    unlabeled_grouped = defaultdict(list)
    for app, label, vec in zip(n_app_nums, n_col_names, n_vectors):
        unlabeled_grouped[label].append((app, vec))

    # ===== Collection Info =====
    # result = session.query(CollectionInfo).first()
    total_docs = len(app_nums)
    cnt, inserted, skipped = 0, 0, 0
    for key, value in grouped.items():
        db_collection_data_num = session.query(CollectionInfo)\
            .with_entities(CollectionInfo.collection_data_num)\
            .filter_by(project_id=project_id, collection_name=key).first()

        vecs = [np.array(vec) for _, vec in value]
        mean_vec = np.mean(vecs, axis=0)
        
        collection = session.query(CollectionInfo).filter_by(
            project_id=project_id, collection_name=key
        ).first()
        if not collection:
            collection_size = len(value) 
            if db_collection_data_num:
                collection_size += db_collection_data_num
                total_docs += db_collection_data_num
            collection = CollectionInfo(
                user_id=user_id,
                project_id=project_id,
                project_code=project_code,
                project_name=project_name,
                collection_code=str(uuid.uuid4()),
                source_type=source_type,
                
                collection_name=key,
                collection_category=cnt,
                collection_data_num=collection_size,
                collection_data_ratio=collection_size / total_docs if total_docs else 0,
                mean_vector=mean_vec,
                created_datetime=datetime.now(),
                updated_datetime=datetime.now(),
            )
            session.add(collection)
            cnt += 1
    session.flush()
    session.commit()
    session.refresh(collection)

    # ===== Project Info =====
    total = 0
    labeled_num = 0
    unlabeled_num = 0
    collections_num = 0
    if existing_count:
        total = session.query(ProjectData).filter_by(project_id=project_id).count()
        labeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=1).count()
        unlabeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=0).count()
        collections_num = session.query(CollectionInfo).filter_by(project_id=project_id).count()

    session.query(ProjectInfo).filter(ProjectInfo.id == project_id).update(
        {
            ProjectInfo.project_status: 2,
            ProjectInfo.collection_num: collections_num + len(grouped.keys()),
            ProjectInfo.labeled_documents: labeled_num + len(app_nums),
            ProjectInfo.unlabeled_documents: unlabeled_num + len(n_app_nums),
        }
    )

    # ===== Project Data =====
    for i in range(len(app_nums)):
        # project = session.query(ProjectData).filter_by(project_id=project_id).first()
        project = ProjectData(
            user_id=user_id,
            project_id=project_id,
            source_type=source_type,
            project_code=project_code,
            # project_name=project_name,
            # collection_id=,
            # collection_code=str(uuid.uuid4()),
            application_number=app_nums[i],
            collection_name=col_names[i],
            title=titles[i],
            abstract=abstracts[i],
            created_datetime=datetime.now(),
            updated_datetime=datetime.now(),
            used=1
        )
        session.add(project)
    for i in range(len(n_app_nums)):
        # project = session.query(ProjectData).filter_by(project_id=project_id).first()
        project = ProjectData(
            user_id=user_id,
            project_id=project_id,
            source_type=source_type,
            project_code=project_code,
            # project_name=project_name,
            # collection_id=,
            # collection_code=str(uuid.uuid4()),
            application_number=n_app_nums[i],
            collection_name=n_col_names[i],
            title=n_titles[i],
            abstract=n_abstracts[i],
            created_datetime=datetime.now(),
            updated_datetime=datetime.now(),
            used=0
        )
        session.add(project)
    session.flush()
    session.commit()
    session.refresh(project)

    return {"inserted": inserted, "skipped": skipped}

def get_project_data(session: Session, project_id: int):
    rows = session.query(ProjectData).filter_by(project_id=project_id, used=1).all()
    items = [
        {
            "application_number": r.application_number,
            "title": r.title,
            "abstract": r.abstract,
            "collection_name": r.collection_name,
        }
        for r in rows
    ]
    return {"status": True, "items": items}

def update_project_data(session: Session, project_id: int, data: dict):
    items = data.get("items", [])
    if not items:
        return {"status": False, "message": "업데이트할 데이터 없음"}

    updated = 0
    for item in items:
        app_num = item.get("application_number")
        if not app_num:
            continue

        row = (
            session.query(ProjectData)
            .filter_by(project_id=project_id, application_number=app_num)
            .first()
        )
        if not row:
            continue

        if "title" in item:
            row.title = item["title"]
        if "collection_name" in item:
            row.collection_name = item["collection_name"]

        updated += 1

    session.commit()
    return {"status": True, "message": f"{updated}건 업데이트 완료"}

def get_project_stats(session: Session, project_id: int):
    project_info = (
        session.query(ProjectInfo)
        .filter_by(id=project_id)
        .first()
    )
    collection_info = (
        session.query(CollectionInfo)
        .filter_by(project_id=project_id)
        .all()
    )
    
    return {
        'project_info': project_info,
        'collection_info': collection_info
    }