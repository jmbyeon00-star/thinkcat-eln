# app/services/project_service.py
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.project_model import ProjectInfo, ProjectData
from app.models.ai_model import ModelInfo
from app.models.file_model import FileInfo
from app.schemas.project_schema import ProjectCreate
from app.models.collection_model import CollectionInfo
from app.utils.common import *

import os
import uuid
import traceback
import numpy as np
from typing import Tuple, List, Dict, Optional, Any
from collections import defaultdict
from datetime import datetime

def create_project(req: ProjectCreate, session: Session, user_id: int) -> ProjectInfo:
    # project_code = "PRJ-" + secrets.token_hex(4).upper()
    project_code = generate_project_code()
    project = ProjectInfo(
        user_id=user_id,
        project_code=project_code,
        project_name=req.project_name,
        project_description=req.project_description,
        collection_num=0,
        source_type=req.source_type,
        task_type=req.task_type
    )
    project.project_status = 0
    session.add(project)
    session.commit()
    session.refresh(project)
    
    return project

def create_collection(session: Session, user_id: int, project_id: int, name: str):
    # 1. 고유한 collection_code 또는 project_code 생성 로직 필요 (예: UUID 또는 slug)
    # project_info = session.query(ProjectInfo.source_type, ProjectInfo.project_code, ProjectInfo.project_name).filter(ProjectInfo.id==project_id).first()
    project_info = session.query(ProjectInfo).filter(ProjectInfo.id==project_id).first()

    if not project_info:
        # 프로젝트 정보가 없으면 예외 처리 (필수)
        raise HTTPException(status_code=404, detail="Project not found")
    
    p_source_type = project_info.source_type.value
    p_project_code = project_info.project_code
    p_project_name = project_info.project_name

    print(">>> p_source_type:", p_source_type, type(p_source_type))
    # collection_code = f"{project_id}_{name.replace(' ', '_')}_{str(uuid.uuid4())[:4]}"
    collection_code = generate_collection_code()

    collection_info = session.query(CollectionInfo).filter(CollectionInfo.project_id==project_id).all()
    total_collection = len(collection_info)
    
    # 2. 새 CollectionInfo 인스턴스 생성
    new_collection = CollectionInfo(
        user_id=user_id,
        source_type=p_source_type,
        project_id=project_id,
        project_code=p_project_code,
        project_name=p_project_name,
        collection_name=name,
        collection_category=total_collection+1,
        collection_code=collection_code,
        collection_data_num=0,
        collection_data_ratio=0.0,
        # updated_datetime=datetime.now()
    )

    project_info.collection_num = total_collection+1
    
    # 3. DB에 추가 및 커밋
    session.add(new_collection)
    session.commit()
    session.refresh(new_collection)
    
    return new_collection

# def list_projects(session: Session):
#     return session.query(ProjectInfo).all()
def get_projects(session: Session, user_id: int, page: int = 1, limit: int = 10, q: str | None = None):
    query = session.query(ProjectInfo).filter(ProjectInfo.user_id == user_id)

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

def get_project_and_models(session: Session, user_id: int, project_id: int):
    project_info = session.query(ProjectInfo).get(project_id)
    model_query = session.query(ModelInfo).filter(ModelInfo.data_id == project_id)
    model_count =  model_query.count()

    model_info = (
        model_query.filter(
            ModelInfo.user_id==user_id, 
            ModelInfo.data_id==project_id
        )
        .order_by(
            ModelInfo.accuracy.desc()
        )
        .all()
    )
    mean_score = 0
    if model_info:
        model_records = [item.to_dict() for item in model_info]
        scores = [item["accuracy"] for item in model_records]
        mean_score = sum(scores) / len(scores)

    if project_info:
        project_records = project_info.to_dict()
        project_records = {**project_records, "mean_score": mean_score * 100, "model_count": model_count}
    
    # >>> 최근 활동 테이블 생성 및 로그 별도 관리 필요
    
    return {"project_info": project_records, "models": None if not model_info else model_records}
    

def get_project_models(session, user_id, project_id, page, limit, q):
    model_query = session.query(ModelInfo).filter(ProjectInfo.id == project_id)

    if q:
        model_query = session.query.filter(
            or_(
                ModelInfo.model_name.ilike(f"%{q}%"),
                ModelInfo.model_description.ilike(f"%{q}%"),
                ModelInfo.task_type.ilike(f"%{q}%"),
            )
        )

    model_list = (
        model_query.filter(ModelInfo.user_id==user_id, ModelInfo.data_id==project_id).order_by(ModelInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )
    project_detail = (
        session.query(ProjectInfo).filter(ProjectInfo.user_id==user_id, ProjectInfo.id==project_id).first()
    )

    total = model_query.count()
    return {
        "project_info": project_detail,
        "model_list": model_list,
        "total": total,
        "page": page,
        "limit": limit,
    }

def get_inference_results(session, user_id, project_id, model_id, page, limit, q):
    model_info = session.query(ModelInfo).filter(
        ModelInfo.data_id==project_id
    ).all()
    project_model_ids = [model_obj.id for model_obj in model_info]
    
    query = session.query(FileInfo).filter(
        FileInfo.user_id == user_id,
        # FileInfo.model_id.in_(model_ids)
    )
    if model_id:
        query = query.filter(FileInfo.model_id == model_id)
        # print(f">>> 특정 모델 필터링 적용: model_id={model_id}")
    else:
        query = query.filter(FileInfo.model_id.in_(project_model_ids))
        # print(">>> 전체 모델 필터링 적용: project_model_ids 사용")

    if q:
        query = query.filter(
            or_(
                func.lower(FileInfo.file_name).like(f"%{q.lower()}%"), # 대소문자 구분 없이 검색
                func.lower(FileInfo.model_code).like(f"%{q.lower()}%"),
            )
        )

    total = query.count()
    items = (
        query.order_by(FileInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "results": [f.to_dict() for f in items],
        "models": model_info,
        "total": total,
        "page": page,
        "limit": limit,
    }

def get_project_data(session: Session, project_id: int):
    types = session.query(
        ProjectInfo.source_type,
        ProjectInfo.task_type,
        ProjectInfo.project_code,
        ProjectInfo.project_name
    ).filter_by(id=project_id).first()

    rows = session.query(ProjectData).filter_by(project_id=project_id, used=1).all()
    items = [
        {
            "pdid": r.id,
            "application_number": r.application_number,
            "title": r.title,
            "abstract": r.abstract,
            "collection_name": r.collection_name,
        }
        for r in rows
    ]

    return {
        "status": True,
        "items": items,
        "types": {
            "source_type": types[0],
            "task_type": types[1],
            "project_code": types[2],
            "project_name": types[3],
        } if types else {}
    }

def get_project_stats(session: Session, project_id: int):
    # project_groups = (
    #     session.query(
    #         ProjectData.group_code,
    #         func.count(ProjectData.id).label('data_count')
    #     )
    #     .filter_by(project_id=project_id)
    #     .group_by(ProjectData.group_code)
    #     .all()
    # )
    # group_stats = [{"group_code": g[0], "count": g[1]} for g in project_groups]
    
    # 1. 모든 그룹 리스트 가져오기 (Select 박스용)
    group_list = session.query(
        ProjectData.group_code,
        func.count(ProjectData.id).label('cnt')
    ).filter_by(project_id=project_id).group_by(ProjectData.group_code).all()

    # 2. 그룹별 컬렉션 분포 데이터 가져오기
    # 예: (group_code, collection_name, count)
    stats_raw = session.query(
        ProjectData.group_code,
        CollectionInfo.collection_name,
        func.count(ProjectData.id).label('doc_count')
    ).join(CollectionInfo, ProjectData.collection_id == CollectionInfo.id) \
     .filter(ProjectData.project_id == project_id) \
     .group_by(ProjectData.group_code, CollectionInfo.collection_name).all()

    # 프론트엔드에서 필터링하기 쉬운 구조로 변환
    group_distribution = {}
    for g_code, c_name, count in stats_raw:
        if g_code not in group_distribution:
            group_distribution[g_code] = []
        group_distribution[g_code].append({"name": c_name, "value": count})

    print(">>> group_distribution:", group_distribution)

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
        'collection_info': collection_info,
        'group_list': [{"code": g[0], "total": g[1]} for g in group_list],
        "group_distribution": group_distribution, # { "group_A": [{"name": "Label1", "value": 10}, ...], "group_B": [...] }
    }

def get_project_collections(session: Session, user_id: int, project_id: int, page: int, limit: int, q: str) -> Dict[str, Any]:
    project_info = session.query(ProjectInfo).filter(ProjectInfo.user_id == user_id, ProjectInfo.id == project_id).first()
    # 1. 프로젝트 전체 컬렉션 데이터 수 계산
    # CollectionInfo.collection_data_num의 합계를 구합니다.
    total_data_num_query = session.query(
        func.sum(CollectionInfo.collection_data_num).label('total_data')
    ).filter(CollectionInfo.project_id == project_id)

    # 쿼리 결과를 가져옵니다. (결과가 None일 경우 0으로 처리)
    total_data_num = total_data_num_query.scalar() or 0

    # 2. 페이지네이션을 위한 쿼리
    query = session.query(CollectionInfo).filter(CollectionInfo.user_id == user_id, CollectionInfo.project_id == project_id)

    # 검색어 처리 (기존 코드 유지)
    if q:
        query = query.filter(
            or_(
                func.lower(CollectionInfo.collection_name).like(f"%{q.lower()}%"),
                # func.lower(CollectionInfo.project_name).like(f"%{q.lower()}%"),
            )
        )
    
    total_count = query.count() # 전체 컬렉션 개수
    
    items = (
        query.order_by(CollectionInfo.created_datetime.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # 3. 응답 데이터 구성 및 통계 추가
    collections_info: List[Dict[str, Any]] = []
    for item in items:
        item_dict = item.to_dict()
        
        # collection_data_ratio 필드가 이미 DB 필드에 이미 있지만 실시간으로 계산하여 추가
        if total_data_num > 0:
            ratio = (item_dict['collection_data_num'] / total_data_num) * 100
            item_dict['calculated_ratio'] = round(ratio, 2)
        else:
            item_dict['calculated_ratio'] = 0.0

        collections_info.append(item_dict)
    
    return {
        "project_info": project_info.to_dict(),
        "collection_info": collections_info,
        "total_collections": total_count,      # 페이지네이션을 위한 전체 컬렉션 수
        "total_data_num": total_data_num,      # 프로젝트의 전체 데이터 수 (통계)
        "page": page,
        "limit": limit
    }

# def get_project_collection(session: Session, user_id: int, project_id: int, page: int, limit: int, q: str) -> Dict[str, Any]:
#     query = session.query(CollectionInfo).filter_by(project_id=project_id)
#     if q:
#         query = query.filter(
#             or_(
#                 func.lower(CollectionInfo.collection_name).like(f"%{q.lower()}%"), # 대소문자 구분 없이 검색
#                 func.lower(CollectionInfo.project_name).like(f"%{q.lower()}%"),
#             )
#         )
#     total = query.count()

#     items = (
#         query.order_by(CollectionInfo.created_datetime.desc())
#         .offset((page - 1) * limit)
#         .limit(limit)
#         .all()
#     )

#     return {
#         "collections": [f.to_dict() for f in items],
#         "total": total,
#         "page": page,
#         "limit": limit
#     }

def get_project_data_groups(session: Session, user_id, project_id, page: int = 1, limit: int = 10, q: str | None = None):
    collection_info = session.query(CollectionInfo).filter(CollectionInfo.project_id == project_id).all()
    project_info = session.query(ProjectInfo).filter(ProjectInfo.id == project_id).first()
    # query = session.query(ProjectData).filter(ProjectData.project_id == project_id).group_by(ProjectData.group_code).all()
    base_query = session.query(ProjectData).filter(ProjectData.project_id == project_id)
    if q:
        base_query = base_query.filter(ProjectData.collection_name.ilike(f'%{q}%'))
    
    total_group_query = base_query.with_entities(ProjectData.group_code).distinct()
    total_count = total_group_query.count()
    offset = (page - 1) * limit
    
    paginated_group_codes_result = (
        total_group_query # 이미 distinct된 쿼리
        .order_by(ProjectData.group_code) # 안정적인 페이지네이션을 위해 정렬 필수
        .offset(offset)
        .limit(limit)
        .all()
    )

    group_codes = [gc[0] for gc in paginated_group_codes_result]
    rows = (
        session.query(ProjectData)
        .filter(ProjectData.project_id == project_id)
        .filter(ProjectData.group_code.in_(group_codes))
        .all()
    )
    grouped_data_with_count = {}

    temp_groups = defaultdict(list)
    for row in rows:
        key = row.group_code if row.group_code else 'UNGROUPED'
        temp_groups[key].append(row)
    
    # 7-2. 최종 결과 구조 생성 (개수 포함)
    for idx, (group_code, data_list) in enumerate(temp_groups.items()):
        grouped_data_with_count[group_code] = {
            "index": idx,
            "count": len(data_list),
            "data": data_list
        }
    
    return {
        "collection_info": collection_info,
        "project_info": project_info,
        "project_data_groups": grouped_data_with_count,
        "total_count": total_count,
        "page": page,
        "limit": limit
    }

# ---- 데이터 입력 ----
def insert_project_data(session: Session, user_id: int, project_id: int, group_code: str, body: dict):
    # ---- 객체 리스트 사용 ----
    # 결과 변수 초기화 (오류 발생 시에도 반환 가능하도록)
    collections_num, labeled_num, unlabeled_num = 0, 0, 0 
    
    try:
        project_info = session.query(ProjectInfo).filter(ProjectInfo.id==project_id, ProjectInfo.user_id==user_id).first()
        
        if not project_info:
            return {"message": "Project not found"}

        # 1. Enum 타입 불일치 해결
        source_type = project_info.source_type.value
        project_code = project_info.project_code
        project_name = project_info.project_name

        # 데이터 추출
        data_list = body.get("items", [])      # Positive 데이터 (used=1)
        n_data_list = body.get("n_items", [])  # Negative 데이터 (used=0)

        all_data = data_list + n_data_list
        
        if not data_list and not n_data_list:
            return {"message": "No data provided"}
        
        # Positive 데이터만으로 컬렉션 정보 갱신에 사용할 컬렉션 이름 리스트 생성
        col_names = [doc.get("label") or doc.get("collection_name") for doc in data_list if doc.get("label") or doc.get("collection_name")]
        # 전체 문서 수 계산 (기존 used=1 문서 + 이번 요청의 Positive 데이터 수)
        total_existing_docs = session.query(ProjectData).filter_by(project_id=project_id, used=1).count()
        total_docs = total_existing_docs + len(data_list)

        collection_map = {}
        
        has_vectors = any(doc.get("vector") is not None for doc in data_list)

        if has_vectors and len(data_list) > 0:
            
            # 1) 컬렉션별 데이터 구성 (벡터 포함)
            grouped = defaultdict(lambda: {"vectors": [], "count": 0})
            for doc in data_list:
                col_name = doc.get("label") or doc.get("collection_name")
                vector = doc.get("vector")
                
                if col_name and vector is not None:
                    grouped[col_name]["vectors"].append(np.array(vector))
                    grouped[col_name]["count"] += 1
                
            # 2) CollectionInfo 생성/갱신 (벡터 있음)
            for idx, (col_name, data) in enumerate(grouped.items()):
                vecs = data["vectors"]
                new_count = data["count"]
                
                if new_count == 0:
                    continue

                mean_vec = np.mean(vecs, axis=0)
                
                collection = session.query(CollectionInfo).filter_by(
                    project_id=project_id, collection_name=col_name
                ).first()

                if collection:
                    collection.collection_data_num += new_count
                    collection.mean_vector = mean_vec
                    collection.updated_datetime = datetime.now()
                else:
                    collection = CollectionInfo(
                        user_id=user_id,
                        project_id=project_id,
                        project_code=project_code,
                        project_name=project_name,
                        source_type=source_type,
                        collection_code=generate_collection_code(),
                        collection_name=col_name,
                        collection_category=idx,
                        collection_data_num=new_count,
                        collection_data_ratio=0, # 임시 값, 아래에서 일괄 갱신
                        mean_vector=mean_vec,
                        created_datetime=datetime.now(),
                        updated_datetime=datetime.now(),
                    )
                    session.add(collection)
                    session.flush()
                
                collection_map[col_name] = (collection.id, collection.collection_code)
                
        else: # 벡터가 없거나 Positive 데이터가 없는 경우
            # Positive 데이터의 컬렉션 이름만으로 처리
            # unique_collections = set(col_names)

            grouped_counts = defaultdict(int)
            for name in col_names:
                grouped_counts[name] += 1
            
            # for idx, col_name in enumerate(unique_collections):
                # new_count = col_names.count(col_name)
            for idx, (col_name, new_count) in enumerate(grouped_counts.items()):
                
                collection = session.query(CollectionInfo).filter_by(
                    project_id=project_id, collection_name=col_name
                ).first()

                if collection:
                    collection.collection_data_num += new_count
                    collection.updated_datetime = datetime.now()
                else:
                    collection = CollectionInfo(
                        user_id=user_id,
                        project_id=project_id,
                        project_code=project_code,
                        project_name=project_name,
                        source_type=source_type,
                        collection_code=generate_collection_code(),
                        collection_name=col_name,
                        collection_category=idx,
                        collection_data_num=new_count,
                        collection_data_ratio=0, # 임시 값, 아래에서 일괄 갱신
                        mean_vector=None,
                        created_datetime=datetime.now(),
                        updated_datetime=datetime.now(),
                    )
                    session.add(collection)
                    session.flush()

                collection_map[col_name] = (collection.id, collection.collection_code)
        
        session.commit()
        
        # 3) CollectionInfo의 collection_data_ratio 및 used=1 실측 기반 갱신
        current_collections = set(col_names) 
        
        # 이번 요청에 포함된 컬렉션 (num은 이미 갱신됨, ratio만 갱신)
        collections_to_update = session.query(CollectionInfo).filter(
            CollectionInfo.project_id == project_id,
            CollectionInfo.collection_name.in_(current_collections)
        ).all()
        
        for c in collections_to_update:
            c.collection_data_ratio = (c.collection_data_num / total_docs) if total_docs else 0
            c.updated_datetime = datetime.now()
        
        # 이번 요청에 포함되지 않은 컬렉션 (num, ratio 모두 used=1 기준으로 실측 갱신)
        other_collections = (
            session.query(CollectionInfo)
            .filter(CollectionInfo.project_id == project_id)
            .filter(~CollectionInfo.collection_name.in_(current_collections))
            .all()
        )

        for c in other_collections:
            used_in_collection = session.query(ProjectData).filter_by(
                project_id=project_id,
                collection_id=c.id,
                used=1
            ).count()

            c.collection_data_num = used_in_collection
            c.collection_data_ratio = (used_in_collection / total_docs) if total_docs else 0
            c.updated_datetime = datetime.now()

        session.commit()

        # 4) ProjectData 삽입/갱신
        def add_project_data(data_list, group_code, used_flag):
            now = datetime.now()
            added_count = 0
            
            for doc in data_list:
                col = doc.get("label") or doc.get("collection_name")
                app = doc.get("application_number")
                title = doc.get("title")
                abstract = doc.get("abstract")

                c_id, c_code = collection_map.get(col, (None, None))

                # # 🚨 1. Application Number가 없으면 건너뛰기 (기존 로직 유지)
                # if not app: continue

                # # 🚨 2. **추가된 중복 검사 로직**
                # # 이미 존재하는 ProjectData 레코드인지 확인합니다.
                # existing_data = session.query(ProjectData).filter_by(
                #     project_id=project_id, 
                #     application_number=app,
                #     # (선택 사항: used=1 인 데이터만 중복 검사할지 여부는 비즈니스 로직에 따라 결정)
                # ).first()

                # if existing_data:
                #     # 중복 데이터가 존재하면 건너뛰고, 이미 사용된 것으로 간주합니다.
                #     # 또는 필요한 경우 (used 플래그 변경 등) 업데이트 로직을 추가할 수 있습니다.
                #     print(f"DEBUG: Skipping duplicate application_number: {app}")
                #     continue

                session.add(
                    ProjectData(
                        group_code=group_code,
                        user_id=user_id,
                        project_id=project_id,
                        source_type=source_type,
                        project_code=project_code,
                        collection_id=c_id,
                        collection_code=c_code,
                        collection_name=col,
                        application_number=app,
                        title=title,
                        abstract=abstract,
                        used=used_flag,
                        created_datetime=now,
                        updated_datetime=now
                    )
                )
                added_count += 1
            
            session.flush()
            
            if added_count > 0:
                # project_info 갱신
                project_info = session.query(ProjectInfo).filter_by(id=project_id).first()
                if project_info:
                    project_info.updated_datetime = now
        
        # ProjectData 입력 직전
        # print(f"DEBUG: collection_map size: {len(collection_map)}")
        # print(collection_map)

        if data_list: # Positive 데이터 입력
            add_project_data(data_list, group_code, used_flag=1)
        
        if n_data_list: # Negative 데이터 입력
            add_project_data(n_data_list, group_code, used_flag=0)

        session.commit()

        # 5) ProjectInfo 최종 갱신
        collections_num = session.query(CollectionInfo).filter_by(project_id=project_id).count()
        labeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=1).count()
        unlabeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=0).count()

        session.query(ProjectInfo).filter(ProjectInfo.id == project_id).update(
            {
                ProjectInfo.project_status: 2,
                ProjectInfo.collection_num: collections_num,
                ProjectInfo.labeled_documents: labeled_num,
                ProjectInfo.unlabeled_documents: unlabeled_num,
                ProjectInfo.updated_datetime: datetime.now(),
            }
        )
        session.commit()
        
        return {
            "message": "Project data inserted/updated successfully",
            "collections": collections_num,
            "labeled": labeled_num,
            "unlabeled": unlabeled_num
        }
        
    except Exception as e:
        print(f"Error during data processing: {str(e)}")
        session.rollback() # 오류 발생 시 롤백
        
        # 최종 반환 시점의 변수 값을 사용하여 메시지를 구성합니다.
        return {
            "message": f"Error during data processing: {str(e)}",
            "collections": collections_num,
            "labeled": labeled_num,
            "unlabeled": unlabeled_num
        }

def insert_project_data_v1(session: Session, user_id: int, project_id: int, body: dict):
    # ---- 개별 리스트 데이터 사용 ----
    try:
        group_code = generate_data_group_code()

        source_type = body.get("source_type", "")
        project_code = body.get("project_code", "")
        project_name = body.get("project_name", "")

        app_nums = body.get("application_numbers", [])
        col_names = body.get("collection_name", [])
        titles = body.get("title", [])
        abstracts = body.get("abstract", [])
        vectors = body.get("vector", [])

        n_app_nums = body.get("n_application_number", [])
        n_col_names = body.get("n_collection_name", [])
        n_titles = body.get("n_title", [])
        n_abstracts = body.get("n_abstract", [])
        n_vectors = body.get("n_vector", [])

        if not app_nums:
            return {"message": "No data provided"}
        
        total_existing_docs  = session.query(ProjectData).filter_by(project_id=project_id, used=1).count()
        total_docs = total_existing_docs + len(app_nums)

        collection_map = {}
        if vectors and len(vectors) > 0:
        
            # ---- 1) 컬렉션별 데이터 구성 (라벨=컬렉션명) ----
            grouped = defaultdict(list)
            for app, label, vec in zip(app_nums, col_names, vectors):
                grouped[label].append(np.array(vec))
            
            # ---- 2) CollectionInfo 생성/갱신 ----
            for idx, (col_name, vecs) in enumerate(grouped.items()):
                mean_vec = np.mean(vecs, axis=0)
                new_count = len(vecs)

                collection = session.query(CollectionInfo).filter_by(
                    project_id=project_id, collection_name=col_name
                ).first()

                if collection:
                    collection.collection_data_num += new_count

                    collection.collection_data_ratio = (
                        (collection.collection_data_num) / total_docs
                        if total_docs else 0
                    )
                    
                    collection.mean_vector = mean_vec # 평균 벡터 수정 필요(2025-10-15)
                    collection.updated_datetime = datetime.now()
                else:
                    collection = CollectionInfo(
                        user_id=user_id,
                        project_id=project_id,
                        project_code=project_code,
                        project_name=project_name,
                        source_type=source_type,
                        # collection_code=str(uuid.uuid4()),
                        collection_code=generate_collection_code(),
                        collection_name=col_name,
                        collection_category=idx,
                        collection_data_num=new_count,
                        collection_data_ratio=(new_count / total_docs) if total_docs else 0,
                        mean_vector=mean_vec,
                        created_datetime=datetime.now(),
                        updated_datetime=datetime.now(),
                    )
                    session.add(collection)
                    session.flush()
                
                collection_map[col_name] = (collection.id, collection.collection_code)
        else:
            unique_collections = set(col_names)
            for idx, col_name in enumerate(unique_collections):
                new_count = sum(1 for c in col_names if c == col_name)

                collection = session.query(CollectionInfo).filter_by(
                    project_id=project_id, collection_name=col_name
                ).first()

                if collection:
                    collection.collection_data_num += new_count
                    collection.collection_data_ratio = (
                        collection.collection_data_num / total_docs if total_docs else 0
                    )
                    collection.updated_datetime = datetime.now()
                else:
                    collection = CollectionInfo(
                        user_id=user_id,
                        project_id=project_id,
                        project_code=project_code,
                        project_name=project_name,
                        source_type=source_type,
                        collection_code=generate_collection_code(),
                        collection_name=col_name,
                        collection_category=idx,
                        collection_data_num=new_count,
                        collection_data_ratio=(new_count / total_docs) if total_docs else 0,
                        mean_vector=None,  # 벡터 없음
                        created_datetime=datetime.now(),
                        updated_datetime=datetime.now(),
                    )
                    session.add(collection)
                    session.flush()

                collection_map[col_name] = (collection.id, collection.collection_code)
        session.commit()

        # session.refresh(collection)

        # ---- 2.5) CollectionInfo 갱신 ----
        
        # 이번 요청에서 사용된 컬렉션명 목록
        # current_collections = set(col_names + n_col_names)
        current_collections = set(col_names)
        
        # 이번 요청에 포함되지 않은 컬렉션만 조회
        other_collections = (
            session.query(CollectionInfo)
            .filter(CollectionInfo.project_id == project_id)
            .filter(~CollectionInfo.collection_name.in_(current_collections))
            .all()
        )


        for c in other_collections:
            # 현재 컬렉션 내 사용중(used=1) 문서 수
            used_in_collection = session.query(ProjectData).filter_by(
                project_id=project_id,
                collection_id=c.id,
                used=1
            ).count()

            # used=1 개수로 교체 (누적이 아니라 실측 기준)
            # c.collection_data_num = used_in_collection
            c.collection_data_ratio = (
                (used_in_collection / total_docs) if total_docs else 0
            )
            c.updated_datetime = datetime.now()

        session.commit()

        # ---- 3) ProjectData 삽입/갱신 ----
        def add_project_data(app_nums, col_names, titles, abstracts, group_code, used_flag):
            now = datetime.now()
            before_count = session.query(ProjectData).filter_by(
                project_id=project_id
            ).count()

            added_count = 0
            for app, col, title, abstract in zip(app_nums, col_names, titles, abstracts):
                c_id, c_code = collection_map.get(col, (None, None))
                # 중복 안전: 이미 있으면 업데이트(권장)
                # existing = session.query(ProjectData).filter_by(
                #     project_id=project_id, application_number=app
                # ).first()

                # if existing:
                #     existing.collection_id   = c_id
                #     existing.collection_code = c_code
                #     existing.collection_name = col
                #     existing.title           = title
                #     existing.abstract        = abstract
                #     existing.used            = used_flag
                #     existing.updated_datetime = datetime.now()
                # else:
                session.add(
                    ProjectData(
                        group_code=group_code,
                        user_id=user_id,
                        project_id=project_id,
                        source_type=source_type,
                        project_code=project_code,
                        collection_id=c_id,
                        collection_code=c_code,
                        collection_name=col,
                        application_number=app,
                        title=title,
                        abstract=abstract,
                        used=used_flag,
                        created_datetime=now,
                        updated_datetime=now,
                    )
                )
                added_count += 1
            
            session.flush()
            after_count = session.query(ProjectData).filter_by(
                project_id=project_id
            ).count()
            added_count2 = after_count - before_count

            print(">>> 현재 시각:", now)
            print(">>> 프로젝트 데이터 추가 전 갯수:", before_count)
            print(">>> 프로젝트 데이터 추가 후 갯수:", after_count)
            print(">>> 추가된 데이터:", added_count)
            print(">>> 추가된 데이터2:", added_count2)
            if added_count > 0:
                project_info = session.query(ProjectInfo).filter_by(id=project_id).first()
                project_info.updated_datetime = now

            session.commit()

        if n_app_nums:
            add_project_data(n_app_nums, n_col_names, n_titles, n_abstracts, group_code, used_flag=0)

        add_project_data(app_nums, col_names, titles, abstracts, group_code, used_flag=1)

        session.commit()

        # === ProjectInfo 갱신 ===
        collections_num = session.query(CollectionInfo).filter_by(project_id=project_id).count()
        labeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=1).count()
        unlabeled_num = session.query(ProjectData).filter_by(project_id=project_id, used=0).count()

        session.query(ProjectInfo).filter(ProjectInfo.id == project_id).update(
            {
                ProjectInfo.project_status: 2,
                ProjectInfo.collection_num: collections_num,
                ProjectInfo.labeled_documents: labeled_num,
                ProjectInfo.unlabeled_documents: unlabeled_num,
                ProjectInfo.updated_datetime: datetime.now(),
            }
        )
        session.commit()
    except Exception as e:
        print(str(e))

    return {
        "message": "Project data inserted/updated successfully",
        "collections": collections_num,
        "labeled": labeled_num,
        "unlabeled": unlabeled_num
    }


# ---- 데이터 수정 ----
def update_project_statistics(session: Session, project_id: int, updated: int):
    # 1. 현재 존재하는 컬렉션 목록 조회
    existing_collections = (
        session.query(ProjectData.collection_name)
        .filter_by(project_id=project_id)
        .distinct()
        .all()
    )
    existing_collections = set(c[0] for c in existing_collections)

    # 2. COLLECTION_INFO_TB에 등록된 컬렉션 목록 조회
    registered_collections = (
        session.query(CollectionInfo.collection_name)
        .filter_by(project_id=project_id)
        .all()
    )
    registered_collections = set(c[0] for c in registered_collections)

    # 3. 삭제 대상 컬렉션 도출 및 삭제
    collections_to_delete = registered_collections - existing_collections
    if collections_to_delete:
        session.query(CollectionInfo).filter(
            CollectionInfo.project_id == project_id,
            CollectionInfo.collection_name.in_(collections_to_delete)
        ).delete(synchronize_session=False)

    # 4. 프로젝트 전체 컬렉션 수 업데이트
    session.query(ProjectInfo).filter_by(id=project_id).update({
        "collection_num": len(existing_collections)
    })

    # 5. 전체 데이터 수
    total_data_count = (
        session.query(ProjectData)
        .filter_by(project_id=project_id)
        .count()
    )

    # 6. 각 컬렉션별 데이터 수 및 비율 계산
    for cname in existing_collections:
        data_count = (
            session.query(ProjectData)
            .filter_by(project_id=project_id, collection_name=cname)
            .count()
        )
        ratio = round(data_count / total_data_count, 4) if total_data_count else 0.0

        session.query(CollectionInfo).filter_by(project_id=project_id, collection_name=cname).update({
            "collection_data_num": data_count,
            "collection_data_ratio": ratio
        })

    session.commit()

def update_project_data(session: Session, project_id: int, data: dict):
    items = data.get("items", [])
    
    if not items:
        return {"status": False, "message": "업데이트할 데이터 없음"}

    updated = 0
    for item in items:
        pdid = item.get("pdid")
        if not pdid:
            continue

        row = (
            session.query(ProjectData)
            .filter_by(project_id=project_id, id=pdid)
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

    # 통계 업데이트 함수 호출
    # update_project_statistics(session, project_id, updated)

    return {"status": True, "message": f"{updated}건 업데이트 완료"}

# file upload
import json, uuid, numpy as np, pandas as pd
from datetime import datetime
from sqlalchemy.orm import Session
# from elasticsearch import Elasticsearch
from collections import defaultdict
from app.models.project_model import ProjectData
from app.models.collection_model import CollectionInfo

ELASTICSEARCH_HOST = "elasticsearch"  # docker-compose에서 ES 컨테이너 이름

async def handle_uploaded_file(db: Session, user_id: int, project_id: int, project_info: dict, upload_file):
    """
    업로드된 CSV/XLSX 파일을 저장 후 파싱하여 insert_project_data_with_file에 전달
    """
    try:
        # 1️⃣ 파일 저장
        base_dir = f"/app/users/{user_id}/data/classification/{project_id}"
        os.makedirs(base_dir, exist_ok=True)

        save_path = os.path.join(base_dir, f"{project_id}_{upload_file.filename}")
        with open(save_path, "wb") as f:
            f.write(await upload_file.read())

        # print(f"[DEBUG] Saved file to {save_path}")

        # 2️⃣ 확장자별 파싱
        if upload_file.filename.endswith(".csv"):
            df = pd.read_csv(save_path, encoding="utf-8-sig")
        elif upload_file.filename.endswith(".xlsx"):
            df = pd.read_excel(save_path)
        else:
            raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

        if df.empty:
            raise HTTPException(status_code=400, detail="빈 파일입니다.")

        records = df.to_dict(orient="records")
        
        body = {
            "source_type": project_info["source_type"],
            "project_code": project_info["project_code"],
            "project_name": project_info["project_name"],
            # Positive 데이터 (업로드된 행들)
            "application_numbers": df.get("application_number", df.get("app_no", [None] * len(df))),
            "collection_name": df.get("collection_name", df.get("label", [None] * len(df))),
            "title": df.get("title", [None] * len(df)),
            "abstract": df.get("abstract", [None] * len(df)),
            # Negative 데이터 없음
            "n_application_number": None,
            "n_collection_name": None,
            "n_title": None,
            "n_abstract": None,
        }
        # print(f"[DEBUG] Prepared body with {len(body['application_numbers'])} positive samples")


        # 3️⃣ DB 삽입 로직 호출
        result = insert_project_data(
            session=db,
            user_id=user_id,
            project_id=project_id,
            body=body,
        )

        return result

    except Exception as e:
        tb = traceback.format_exc()
        print("[ERROR in handle_uploaded_file]", e)
        print(tb)
        raise HTTPException(status_code=500, detail=f"파일 업로드 실패: {e}\n{tb}")

async def insert_project_data_with_file(db: Session, user_id: int, project_id: int, project_info: dict, file_data) -> int:
    try:
        """
        JSON 형태로 업로드된 데이터 처리 (application_number → Elasticsearch에서 vector/title/abstract 병합)
        """
        print("insert_project_data_with_file called")

        # # ✅ 파일 확장자에 따라 파싱
        # if file.filename.endswith(".csv"):
        #     df = pd.read_csv(save_path)
        # elif file.filename.endswith(".xlsx"):
        #     df = pd.read_excel(save_path)
        # else:
        #     raise HTTPException(status_code=400, detail="지원하지 않는 파일 형식입니다.")

        # records = df.to_dict(orient="records")

        # # print(f"[DEBUG] Parsed {len(records)} rows from {file.filename}")
        
        # if not records:
        #     return 0
        
        # # DataFrame으로 변환
        # df = pd.DataFrame(file_data)
        
        # Elasticsearch에서 vector 정보 조회
        # if "application_number" not in df.columns:
            # print("[INFO] No application_number column — inserting raw file data")
            
            # 컬렉션 이름 추출 (없으면 default)
            # cname = df.columns[0] if "collection_name" in df.columns else "default"
            # ccode = str(uuid.uuid4())

            # # 평균 벡터 없이 COLLECTION_INFO_TB 기록
            # insert_collection_info(
            #     db=db,
            #     project_id=project_id,
            #     collection_name=cname,
            #     collection_code=ccode,
            #     data_rows=file_data,
            #     mean_vector=None,  # 벡터 없음
            # )

            # # 파일 데이터 PROJECT_DATA_TB 저장
            # insert_project_data_by_file(db, project_id, file_data)

            # db.commit()
            # return {"status": "success", "inserted": len(file_data)}

            # return {"status": "success"}
            
        # else:
            # ids = [str(row.get("application_number")) for row in file_data if row.get("application_number")]
            # enriched_data = get_vector_by_application_number(df)

            # # 4️⃣ collection_name, collection_code 부여
            # collection_codes = {}
            # for row in enriched_data:
            #     cname = row.get("collection_name") or "default"
            #     if cname not in collection_codes:
            #         collection_codes[cname] = str(uuid.uuid4())
            #     row["collection_code"] = collection_codes[cname]

            # # 5️⃣ CollectionInfo 테이블 삽입
            # for cname, ccode in collection_codes.items():
            #     insert_collection_info(db, project_id, cname, ccode, enriched_data)

            # # 6️⃣ ProjectData 테이블 삽입
            # insert_project_data_by_file(db, project_id, enriched_data)
            # return {"status": "success", "inserted": len(enriched_data)}

            # return {"status": "success"}
        return {"status": "success"}

    except Exception as e:
        tb = traceback.format_exc()
        raise HTTPException(status_code=500, detail=f"{e}\n{tb}")


# def get_vector_by_application_number(df: pd.DataFrame):
#     """Elasticsearch에서 출원번호 기준으로 title / abstract / vector 병합"""
#     if df.empty:
#         return []

#     client = Elasticsearch([{"host": ELASTICSEARCH_HOST, "port": 9200, "scheme": "http"}])
#     index_name = "titleabstract_h"
#     app_list = list(map(str, df["application_number"].tolist()))
#     total_search = pd.DataFrame()

#     for i in range(0, len(app_list), 1000):
#         subset = app_list[i:i+1000]
#         response = client.search(
#             index=index_name,
#             body={
#                 "query": {"terms": {"address": subset}},
#                 "size": 1000,
#             },
#         )
#         hits = response["hits"]["hits"]
#         if not hits:
#             continue

#         data = []
#         for hit in hits:
#             src = hit["_source"]
#             quote = src.get("quote", "")
#             if ";" in quote:
#                 title, abstract = quote.split(";", 1)
#             else:
#                 title, abstract = quote, ""
#             data.append({
#                 "application_number": src.get("address"),
#                 "title_y": title,
#                 "abstract_y": abstract,
#                 "vector": src.get("vector"),
#             })
#         total_search = pd.concat([total_search, pd.DataFrame(data)], ignore_index=True)

#     total_search = total_search.drop_duplicates(subset=["application_number"])
#     merged = pd.merge(df, total_search, how="left", on="application_number")

#     # title / abstract / vector 보완
#     merged["title"] = merged["title"].combine_first(merged["title_y"])
#     merged["abstract"] = merged["abstract"].combine_first(merged["abstract_y"])
#     merged["vector"] = merged["vector"].fillna(0)

#     return merged.to_dict(orient="records")


def insert_collection_info(db, project_id, collection_name, collection_code, data):
    """CollectionInfo 평균 벡터 계산 후 저장"""
    existing = db.query(CollectionInfo).filter(CollectionInfo.collection_code == collection_code).first()
    if existing:
        return

    # vector 평균 계산
    vectors = [d["vector"] for d in data if isinstance(d.get("vector"), list)]
    mean_vec = np.mean(vectors, axis=0).tolist() if len(vectors) > 0 else None

    new_info = CollectionInfo(
        project_id=project_id,
        collection_name=collection_name,
        collection_code=collection_code,
        collection_category=8,
        mean_vector=json.dumps(mean_vec) if mean_vec else None,
        created_datetime=datetime.utcnow(),
        updated_datetime=datetime.utcnow(),
    )
    db.add(new_info)
    db.commit()


def insert_project_data_by_file(db, project_id, data):
    """Elasticsearch로 enrich된 데이터를 ProjectData 테이블에 삽입"""
    records = []
    for item in data:
        filing_date = (
            str(item.get("filing_date", "")).replace(".", "").replace("-", "")
            if "filing_date" in item
            else None
        )
        application_date = (
            f"{filing_date[:4]}-{filing_date[4:6]}-{filing_date[6:]}"
            if filing_date and len(filing_date) == 8
            else None
        )
        
        record = ProjectData(
            project_id=project_id,
            collection_name=item.get("collection_name"),
            collection_code=item.get("collection_code"),
            title=item.get("title"),
            abstract=item.get("abstract"),
            application_number=item.get("application_number"),
            application_date=application_date,
            ipc_code=item.get("ipc_code"),
            cpc_code=item.get("cpc_code"),
            vector=item.get("vector"),
            created_datetime=datetime.utcnow(),
            updated_datetime=datetime.utcnow(),
        )
        records.append(record)

    if records:
        db.add_all(records)
        db.commit()

# def check_source_type(session, project_id, source_type):
#     project_info = session.query(ProjectInfo).filter(ProjectInfo.id==project_id).first()
    # return { "check": source_type == project_info.source_type, "source_type": project_info.source_type}