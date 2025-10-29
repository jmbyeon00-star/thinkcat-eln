# app/services/project_service.py
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.project_model import ProjectInfo, ProjectData
from app.schemas.project_schema import ProjectCreate
from app.models.collection_model import CollectionInfo
from app.utils.common import *

from collections import defaultdict
from datetime import datetime

import os
import uuid
import traceback
import numpy as np

def create_project(req: ProjectCreate, session: Session, user_id: int) -> ProjectInfo:
    # project_code = "PRJ-" + secrets.token_hex(4).upper()
    project_code = generate_project_code()
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

    print(vectors[0])

    print("project_name:", project_name)

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
    def add_project_data(app_nums, col_names, titles, abstracts, used_flag):
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
                    created_datetime=datetime.now(),
                    updated_datetime=datetime.now(),
                )
            )
    
    if n_app_nums:
        add_project_data(n_app_nums, n_col_names, n_titles, n_abstracts, used_flag=0)

    add_project_data(app_nums, col_names, titles, abstracts, used_flag=1)

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

    return {
        "message": "Project data inserted/updated successfully",
        "collections": collections_num,
        "labeled": labeled_num,
        "unlabeled": unlabeled_num
    }

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

    # 통계 업데이트 함수 호출
    update_project_statistics(session, project_id, updated)

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
