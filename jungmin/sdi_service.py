import os
import re
import requests
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, distinct, text as sa_text
from sqlalchemy.orm import Session
from sqlalchemy.dialects.mysql import insert as mysql_insert

from app.models.sdi_model import SdiNewPatent, SdiSearchQuery, SdiCollection, SdiRunLog
from app.models.collection_model import CollectionInfo
from app.models.ai_model import ModelInfo
from app.models.project_model import ProjectInfo
from app.models.file_model import FileInfo, FileData, ProgressStatusType
from app.utils.es_client import get_es
from app.core.config import settings

KIPRIS_URL = "http://plus.kipris.or.kr/openapi/rest/patUtiModInfoSearchSevice/openDateSearchInfo"
KIPRIS_KEY = "Zj2Az8LtBcXurOtnKMYzr3Wg7y4EqvC3frkUWRbyceE="
GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://localhost:8001")
SDI_ES_INDEX = "sdi_new_patents"


def _es_search_direct(es_query: dict, size: int = 200) -> list[str]:
    """SDI_ES_DIRECT=true 시 GPU 백엔드 없이 ES 직접 검색. 로컬 개발 전용."""
    try:
        es = get_es()
        resp = es.search(index=SDI_ES_INDEX, body=es_query, size=size)
        return [hit["_source"]["application_number"] for hit in resp["hits"]["hits"]]
    except Exception as e:
        print(f"[SDI_ES_DIRECT] ES 검색 오류: {e}")
        return []


# ───────────────────────────────────────────
# KIPRIS 수집
# ───────────────────────────────────────────

def _fetch_kipris(open_date: str) -> list[dict]:
    all_patents = []
    docs_start = 1
    while True:
        params = {
            "openDate":  open_date,
            "docsStart": docs_start,
            "docsCount": 500,
            "patent":    "true",
            "utility":   "true",
            "lastvalue": "",
            "sortSpec":  "OPD",
            "descSort":  "false",
            "accessKey": KIPRIS_KEY,
        }
        resp = requests.get(KIPRIS_URL, params=params, timeout=30)
        resp.raise_for_status()
        root = ET.fromstring(resp.text)

        if root.findtext("header/resultCode") != "00":
            raise RuntimeError(f"KIPRIS API 오류: {root.findtext('header/resultMsg')}")

        items = root.findall(".//PatentUtilityInfo")
        if not items:
            break

        for item in items:
            all_patents.append({child.tag: child.text for child in item})

        if len(items) < 500:
            break
        docs_start += 500

    return all_patents


def _to_db_row(p: dict) -> dict:
    return {
        "application_number": p.get("ApplicationNumber") or "",
        "publication_number": p.get("OpeningNumber") or "",
        "open_date":          p.get("OpeningDate") or "",
        "filing_date":        p.get("ApplicationDate") or "",
        "title":              p.get("InventionName"),
        "abstract":           p.get("Abstract"),
        "ipc_code":           p.get("InternationalpatentclassificationNumber"),
        "applicant_name":     p.get("Applicant") or "",
        "end_status":         p.get("RegistrationStatus") or "",
        "es_indexed":         0,
    }


def collect_patents(session: Session, open_date: Optional[str] = None) -> dict:
    """KIPRIS 수집 → DB upsert → ES 인덱싱"""
    if not open_date:
        open_date = (date.today() - timedelta(days=1)).strftime("%Y%m%d")

    patents = _fetch_kipris(open_date)
    if not patents:
        return {"open_date": open_date, "collected": 0, "es_indexed": 0}

    # DB upsert (application_number UNIQUE 기준)
    rows = [_to_db_row(p) for p in patents]
    stmt = mysql_insert(SdiNewPatent).values(rows)
    stmt = stmt.on_duplicate_key_update(
        publication_number=stmt.inserted.publication_number,
        open_date=stmt.inserted.open_date,
        filing_date=stmt.inserted.filing_date,
        title=stmt.inserted.title,
        abstract=stmt.inserted.abstract,
        ipc_code=stmt.inserted.ipc_code,
        applicant_name=stmt.inserted.applicant_name,
        end_status=stmt.inserted.end_status,
    )
    session.execute(stmt)
    session.commit()

    # ES 인덱싱 (es_indexed=0 인 것만)
    unindexed = (
        session.query(SdiNewPatent)
        .filter(SdiNewPatent.open_date == open_date, SdiNewPatent.es_indexed == 0)
        .all()
    )
    es_count = _bulk_index(session, unindexed)

    return {"open_date": open_date, "collected": len(patents), "es_indexed": es_count}




def _bulk_index(session: Session, patents: list[SdiNewPatent]) -> int:
    if not patents:
        return 0

    docs = []
    for p in patents:
        ipc_list = p.ipc_code.split("|") if p.ipc_code else []
        docs.append({
            "application_number": p.application_number,
            "publication_number": p.publication_number,
            "open_date":          p.open_date,
            "filing_date":        p.filing_date,
            "title":              p.title,
            "abstract":           p.abstract,
            "main_ipc_code":      ipc_list[0] if ipc_list else None,
            "sub_ipc_code":       ipc_list[1:] if len(ipc_list) > 1 else [],
            "applicant_name":     p.applicant_name.split("|") if p.applicant_name else [],
            "end_status":         p.end_status or "",
        })

    try:
        resp = requests.post(
            f"{GPU_BACKEND_URL}/gpu/sdi/index",
            json={"patents": docs},
            timeout=60,
        )
        success = resp.json().get("indexed", 0) if resp.ok else 0
    except Exception:
        success = 0

    if success:
        ids = [p.id for p in patents]
        session.query(SdiNewPatent).filter(SdiNewPatent.id.in_(ids)).update(
            {"es_indexed": 1}, synchronize_session=False
        )
        session.commit()
    return success


# ───────────────────────────────────────────
# 검색식 CRUD
# ───────────────────────────────────────────

def create_query(session: Session, user_id: int, project_id: int, query_name: str, query_string: str, collection_id: Optional[int] = None, model_id: Optional[int] = None, is_auto_push: int = 0) -> dict:
    q = SdiSearchQuery(user_id=user_id, project_id=project_id, query_name=query_name, query_string=query_string, collection_id=collection_id, model_id=model_id, is_auto_push=is_auto_push)
    session.add(q)
    session.commit()
    session.refresh(q)

    matched = _match_single_query(session, q, open_date=_prev_open_date())

    classified = 0
    if is_auto_push and matched > 0:
        classified = _auto_push_matched(session, q)

    return {
        "id": q.id,
        "query_name": q.query_name,
        "query_string": q.query_string,
        "collection_id": q.collection_id,
        "model_id": q.model_id,
        "is_auto_push": q.is_auto_push,
        "auto_matched": matched,
        "auto_classified": classified,
    }


def get_queries(session: Session, user_id: int, project_id: Optional[int] = None) -> list[dict]:
    total_sub = (
        session.query(SdiCollection.query_id, func.count(SdiCollection.id).label("total"))
        .group_by(SdiCollection.query_id)
        .subquery()
    )
    unread_sub = (
        session.query(SdiCollection.query_id, func.count(SdiCollection.id).label("unread"))
        .filter(SdiCollection.is_notified == 0)
        .group_by(SdiCollection.query_id)
        .subquery()
    )
    q = (
        session.query(SdiSearchQuery, CollectionInfo, total_sub.c.total, unread_sub.c.unread)
        .outerjoin(CollectionInfo, CollectionInfo.id == SdiSearchQuery.collection_id)
        .outerjoin(total_sub, total_sub.c.query_id == SdiSearchQuery.id)
        .outerjoin(unread_sub, unread_sub.c.query_id == SdiSearchQuery.id)
        .filter(SdiSearchQuery.user_id == user_id)
    )
    if project_id is not None:
        q = q.filter(SdiSearchQuery.project_id == project_id)
    rows = q.order_by(SdiSearchQuery.created_datetime.desc()).all()
    return [
        {
            "id": r.id,
            "project_id": r.project_id,
            "query_name": r.query_name,
            "query_string": r.query_string,
            "collection_id": r.collection_id,
            "collection_name": col.collection_name if col else None,
            "model_id": r.model_id,
            "is_auto_push": r.is_auto_push,
            "is_active": r.is_active,
            "created_datetime": r.created_datetime.isoformat(),
            "collection_count": total or 0,
            "unread_count": unread or 0,
        }
        for r, col, total, unread in rows
    ]


def update_query(session: Session, query_id: int, query_name: str, query_string: str, collection_id: Optional[int] = None, model_id: Optional[int] = None, is_auto_push: int = 0) -> dict:
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"updated": False}
    q.query_name = query_name
    q.query_string = query_string
    q.collection_id = collection_id
    q.model_id = model_id
    q.is_auto_push = is_auto_push
    session.commit()
    session.refresh(q)

    # 자동추가 ON 시 미push 특허 즉시 분류
    auto_classified = 0
    if q.is_auto_push:
        auto_classified = _auto_push_matched(session, q)

    return {
        "updated": True,
        "id": q.id,
        "query_name": q.query_name,
        "query_string": q.query_string,
        "collection_id": q.collection_id,
        "model_id": q.model_id,
        "is_auto_push": q.is_auto_push,
        "auto_classified": auto_classified,
        "updated_datetime": q.updated_datetime.isoformat() if q.updated_datetime else None,
    }


def toggle_auto_push(session: Session, query_id: int, file_id: Optional[int] = None, file_name: Optional[str] = None) -> dict:
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"toggled": False}
    turning_on = q.is_auto_push == 0
    q.is_auto_push = 1 if turning_on else 0
    session.commit()
    classified = 0
    if turning_on:
        classified = _auto_push_matched(session, q, file_id=file_id, file_name=file_name)
    return {"toggled": True, "id": q.id, "is_auto_push": q.is_auto_push, "classified": classified}


def toggle_query_active(session: Session, query_id: int) -> dict:
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"toggled": False}
    q.is_active = 0 if q.is_active else 1
    session.commit()
    return {"toggled": True, "id": q.id, "is_active": q.is_active}


def delete_query(session: Session, query_id: int) -> dict:
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"deleted": False}
    # FK 제약: 연결된 collections 먼저 삭제
    session.query(SdiCollection).filter(SdiCollection.query_id == query_id).delete(synchronize_session=False)
    session.delete(q)
    session.commit()
    return {"deleted": True, "id": query_id}


# ───────────────────────────────────────────
# 검색식 → ES 쿼리 파서
# ───────────────────────────────────────────

def _parse_term(term: str) -> Optional[dict]:
    term = term.strip()

    m = re.match(r'^(.+?)\.ti\.$', term)
    if m:
        return {"match": {"title": m.group(1)}}

    m = re.match(r'^(.+?)\.ab\.$', term)
    if m:
        return {"match": {"abstract": m.group(1)}}

    m = re.match(r'^(.+?)\.ipcm\.$', term, re.IGNORECASE)
    if m:
        return {"prefix": {"main_ipc_code": m.group(1).upper()}}

    m = re.match(r'^(.+?)\.ipcs\.$', term, re.IGNORECASE)
    if m:
        return {"prefix": {"sub_ipc_code": m.group(1).upper()}}

    m = re.match(r'^(.+?)\.ap\.$', term)
    if m:
        return {"prefix": {"applicant_name": m.group(1)}}

    m = re.match(r'^@od(>=|<=|>|<)(\d{8})$', term)
    if m:
        op_map = {">=": "gte", "<=": "lte", ">": "gt", "<": "lt"}
        return {"range": {"open_date": {op_map[m.group(1)]: m.group(2)}}}

    return None


def build_es_query(query_string: str) -> dict:
    tokens = re.split(r'\s+(?:and|or|not)\s+', query_string, flags=re.IGNORECASE)
    operators = re.findall(r'\s+(and|or|not)\s+', query_string, flags=re.IGNORECASE)

    must, should, must_not = [], [], []

    first = _parse_term(tokens[0])
    if first:
        must.append(first)

    for i, op in enumerate(operators):
        clause = _parse_term(tokens[i + 1])
        if not clause:
            continue
        op = op.strip().lower()
        if op == "and":
            must.append(clause)
        elif op == "or":
            should.append(clause)
        elif op == "not":
            must_not.append(clause)

    bool_q: dict = {}
    if must:
        bool_q["must"] = must
    if should:
        bool_q["should"] = should
    if must_not:
        bool_q["must_not"] = must_not

    return {"query": {"bool": bool_q}}


# ───────────────────────────────────────────
# 매칭 & 컬렉션
# ───────────────────────────────────────────

def _prev_open_date() -> str:
    """어제 공개일자 (주말 제외 — 월요일이면 금요일 반환). YYYYMMDD 형식."""
    d = date.today() - timedelta(days=1)
    while d.weekday() >= 5:  # 토(5)·일(6) 건너뜀
        d -= timedelta(days=1)
    return d.strftime("%Y%m%d")


def _match_single_query(session: Session, q: SdiSearchQuery, open_date: Optional[str] = None) -> int:
    """단일 검색식으로 GPU 백엔드 ES 검색 후 sdi_collections 저장. 매칭 건수 반환.
    open_date 지정 시 해당 공개일자의 특허만 검색."""
    es_query = build_es_query(q.query_string)

    if open_date:
        # ES bool filter 절에 open_date 조건 추가
        bool_clause = es_query["query"]["bool"]
        bool_clause.setdefault("filter", []).append({"term": {"open_date": open_date}})

    if settings.SDI_ES_DIRECT:
        app_numbers = _es_search_direct(es_query, size=200)
    else:
        try:
            resp = requests.post(
                f"{GPU_BACKEND_URL}/gpu/sdi/search",
                json={"query": es_query, "size": 200},
                timeout=30,
            )
            app_numbers = resp.json().get("app_numbers", []) if resp.ok else []
        except Exception:
            return 0

    from app.models.sdi_model import _now
    now_kst = _now()
    count = 0
    for app_number in app_numbers:
        stmt = mysql_insert(SdiCollection).values(
            user_id=q.user_id,
            query_id=q.id,
            app_number=app_number,
            matched_datetime=now_kst,
        )
        stmt = stmt.on_duplicate_key_update(matched_datetime=stmt.inserted.matched_datetime)
        session.execute(stmt)
        count += 1

    session.commit()

    # 실행 이력 기록 (0건이어도 날짜 항목이 UI에 표시되도록)
    today = date.today().isoformat()
    run_log = session.query(SdiRunLog).filter(
        SdiRunLog.query_id == q.id,
        SdiRunLog.run_date == today,
    ).first()
    if run_log:
        run_log.matched_count = count
    else:
        session.add(SdiRunLog(query_id=q.id, user_id=q.user_id, run_date=today, matched_count=count))
    session.commit()

    return count




def get_infer_jobs(session: Session, user_id: int, project_id: int) -> list[dict]:
    """프로젝트의 infer_jobs 목록 (model → project_id 조인)"""
    rows = (
        session.query(FileInfo, ModelInfo)
        .join(ModelInfo, ModelInfo.id == FileInfo.model_id)
        .filter(FileInfo.user_id == user_id, ModelInfo.project_id == project_id)
        .order_by(FileInfo.created_datetime.desc())
        .limit(50)
        .all()
    )
    return [
        {
            "id": fi.id,
            "file_code": fi.file_code,
            "file_name": fi.file_name,
            "model_name": mi.model_name,
            "model_id": mi.id,
            "progress_status": str(fi.progress_status.value if hasattr(fi.progress_status, "value") else fi.progress_status),
            "created_datetime": fi.created_datetime.isoformat() if fi.created_datetime else None,
        }
        for fi, mi in rows
    ]


def push_selected_to_infer(session: Session, user_id: int, project_id: int, query_id: int, app_numbers: list[str], file_id: Optional[int] = None, file_name: Optional[str] = None) -> dict:
    """선택한 특허 → infer_job + infer_data + GPU 분류 + infer_results + sdi_collections 업데이트
    file_id 지정 시 해당 infer_job에 추가; 미지정 시 stable key(sdi_q{query_id}_{model_id}) 사용.
    """
    # 1. 검색식 + 분류 모드 결정
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"error": "검색식 없음", "inserted": 0}
    is_binary = bool(q.collection_id)
    eff_project_id = q.project_id or project_id

    # 2. FileInfo + 모델 결정
    if file_id:
        file_info = session.query(FileInfo).filter(FileInfo.id == file_id, FileInfo.user_id == user_id).first()
        if not file_info:
            return {"error": "분류결과 파일을 찾을 수 없습니다.", "inserted": 0}
        model = session.query(ModelInfo).filter(ModelInfo.id == file_info.model_id).first()
        if not model:
            return {"error": "파일에 연결된 모델이 없습니다.", "inserted": 0}
        file_code = file_info.file_code
    else:
        # 모델 결정 (query.model_id 우선, 없으면 프로젝트 최신 모델)
        if q.model_id:
            model = session.query(ModelInfo).filter(ModelInfo.id == q.model_id).first()
        else:
            model = (
                session.query(ModelInfo)
                .filter(ModelInfo.user_id == user_id, ModelInfo.project_id == eff_project_id)
                .order_by(ModelInfo.id.desc())
                .first()
            )
        if not model:
            return {"error": "프로젝트에 모델이 없습니다.", "inserted": 0}
        # stable key로 기존 job 찾기 또는 생성
        file_code = f"sdi_q{query_id}_{model.id}"
        file_info = session.query(FileInfo).filter(FileInfo.file_code == file_code).first()
        if not file_info:
            file_info = FileInfo(
                user_id=user_id,
                model_id=model.id,
                model_code=model.model_code,
                file_code=file_code,
                file_name=file_name or f"SDI [{q.query_name}]",
                file_desc="SDI 신착특허 분류 추론",
                file_size=0,
                progress=0,
                progress_status=ProgressStatusType.RUNNING,
            )
            session.add(file_info)
            session.flush()

    # 3. 이미 push된 특허 제외
    already_pushed = {
        row.app_number
        for row in session.query(SdiCollection.app_number)
        .filter(
            SdiCollection.query_id == query_id,
            SdiCollection.is_pushed == 1,
            SdiCollection.app_number.in_(app_numbers),
        )
        .all()
    }
    to_push = [n for n in app_numbers if n not in already_pushed]

    if not to_push:
        return {"inserted": 0, "skipped": len(already_pushed), "classified": 0}

    # 4. 특허 정보 조회
    patents = session.query(SdiNewPatent).filter(SdiNewPatent.application_number.in_(to_push)).all()
    if not patents:
        return {"error": "특허 정보를 찾을 수 없습니다.", "inserted": 0}

    # 6. infer_data INSERT
    for patent in patents:
        input_text = f"{patent.title or ''} {patent.abstract or ''}".strip()
        session.add(FileData(
            user_id=user_id,
            file_id=file_info.id,
            file_code=file_code,
            model_id=model.id,
            model_code=model.model_code,
            title=patent.title,
            abstract=patent.abstract,
            source=input_text,
            target=None,
            collection_name=None,
        ))
    session.flush()

    # 7. GPU 분류 호출
    patent_docs = [
        {"application_number": p.application_number, "title": p.title, "abstract": p.abstract}
        for p in patents
    ]
    classify_results = []
    try:
        if is_binary:
            resp = requests.post(
                f"{GPU_BACKEND_URL}/gpu/sdi/train_binary",
                json={
                    "user_id": user_id,
                    "collection_id": q.collection_id,
                    "project_id": eff_project_id,
                    "patents": patent_docs,
                },
                timeout=120,
            )
        else:
            resp = requests.post(
                f"{GPU_BACKEND_URL}/gpu/sdi/classify",
                json={
                    "model_id": model.id,
                    "user_id": user_id,
                    "task_type": model.task_type,
                    "patents": patent_docs,
                },
                timeout=120,
            )
        if resp.ok:
            classify_results = resp.json().get("results", [])
    except Exception:
        pass

    # 8. infer_results INSERT + sdi_collections model_class/model_score 업데이트
    result_map = {r["app_number"]: r for r in classify_results}
    for patent in patents:
        r = result_map.get(patent.application_number)
        if not r or r.get("model_class") is None:
            continue
        input_text = f"{patent.title or ''} {patent.abstract or ''}".strip()
        model_class = str(r["model_class"])
        model_score = float(r.get("model_score") or 0.0)
        session.execute(sa_text("""
            INSERT INTO infer_results
                (user_id, model_id, model_code, file_code, input_text, predicted_label, confidence, probability)
            VALUES
                (:user_id, :model_id, :model_code, :file_code, :input_text, :predicted_label, :confidence, :probability)
        """), {
            "user_id": user_id, "model_id": model.id, "model_code": model.model_code,
            "file_code": file_code, "input_text": input_text,
            "predicted_label": model_class, "confidence": model_score, "probability": str(model_score),
        })
        session.query(SdiCollection).filter(
            SdiCollection.user_id == user_id,
            SdiCollection.query_id == query_id,
            SdiCollection.app_number == patent.application_number,
        ).update({"model_class": model_class, "model_score": model_score}, synchronize_session=False)

    # 9. is_pushed 마킹 + file_code 기록
    session.query(SdiCollection).filter(
        SdiCollection.user_id == user_id,
        SdiCollection.query_id == query_id,
        SdiCollection.app_number.in_(to_push),
    ).update({"is_pushed": 1, "file_code": file_code}, synchronize_session=False)

    # 10. infer_job 완료 상태 업데이트
    session.query(FileInfo).filter(FileInfo.file_code == file_code).update(
        {"progress": 100, "progress_status": ProgressStatusType.COMPLETED},
        synchronize_session=False,
    )

    session.commit()
    return {
        "file_id": file_info.id,
        "file_code": file_code,
        "inserted": len(patents),
        "skipped": len(already_pushed),
        "classified": len(classify_results),
    }


def _auto_push_matched(session: Session, q: SdiSearchQuery, file_id: Optional[int] = None, file_name: Optional[str] = None) -> int:
    """is_auto_push=1 일 때 매칭된 미push 특허를 전체 분류 파이프라인으로 처리. 분류 건수 반환."""
    if not q.project_id:
        return 0
    unpushed = (
        session.query(SdiCollection.app_number)
        .filter(SdiCollection.query_id == q.id, SdiCollection.is_pushed == 0)
        .all()
    )
    if not unpushed:
        return 0
    app_numbers = [row.app_number for row in unpushed]
    result = push_selected_to_infer(session, q.user_id, q.project_id, q.id, app_numbers, file_id=file_id, file_name=file_name)
    return result.get("classified", 0)


def match_queries(session: Session) -> dict:
    """모든 활성 검색식으로 ES 검색 후 sdi_collections 저장"""
    queries = session.query(SdiSearchQuery).filter(SdiSearchQuery.is_active == 1).all()
    total_matched = 0
    total_classified = 0
    prev_date = _prev_open_date()
    for q in queries:
        matched = _match_single_query(session, q, open_date=prev_date)
        total_matched += matched
        if q.is_auto_push and matched > 0:
            total_classified += _auto_push_matched(session, q)
    return {"matched": total_matched, "classified": total_classified}


def _push_matched_to_collection(session: Session, q: SdiSearchQuery) -> int:
    """검색식에 연결된 컬렉션으로 매칭된 신착특허를 infer_data에 INSERT. 삽입 건수 반환."""
    if not q.collection_id:
        return 0

    collection = session.query(CollectionInfo).filter(CollectionInfo.id == q.collection_id).first()
    if not collection:
        return 0

    if q.model_id:
        model = session.query(ModelInfo).filter(ModelInfo.id == q.model_id).first()
    else:
        model = (
            session.query(ModelInfo)
            .filter(ModelInfo.user_id == q.user_id, ModelInfo.project_id == collection.project_id)
            .order_by(ModelInfo.id.desc())
            .first()
        )
    if not model:
        return 0

    matched_rows = (
        session.query(SdiCollection, SdiNewPatent)
        .join(SdiNewPatent, SdiNewPatent.application_number == SdiCollection.app_number)
        .filter(SdiCollection.query_id == q.id)
        .all()
    )
    if not matched_rows:
        return 0

    now = datetime.now()
    file_code = f"sdi_{now.strftime('%Y%m%d%H%M%S')}_{model.id}"

    file_info = FileInfo(
        user_id=q.user_id,
        model_id=model.id,
        model_code=model.model_code,
        file_code=file_code,
        file_name=f"SDI 신착특허 {now.strftime('%Y.%m.%d %H:%M')}",
        file_desc="SDI 신착특허 분류 추론",
        file_size=0,
        progress=0,
        progress_status=ProgressStatusType.RUNNING,
    )
    session.add(file_info)
    session.flush()

    inserted_app_numbers = []
    for _, patent in matched_rows:
        session.add(FileData(
            user_id=q.user_id,
            file_id=file_info.id,
            file_code=file_code,
            model_id=model.id,
            model_code=model.model_code,
            title=patent.title,
            abstract=patent.abstract,
            source="",
            target=collection.collection_name,
            collection_name=None,
        ))
        inserted_app_numbers.append(patent.application_number)

    # is_pushed 마킹
    if inserted_app_numbers:
        session.query(SdiCollection).filter(
            SdiCollection.user_id == q.user_id,
            SdiCollection.app_number.in_(inserted_app_numbers),
        ).update({"is_pushed": 1}, synchronize_session=False)

    session.commit()
    return len(inserted_app_numbers)


def push_selected_to_collection(session: Session, user_id: int, collection_id: int, app_numbers: list[str]) -> dict:
    """선택한 특허(app_numbers)를 infer_jobs + infer_data에 INSERT (분류 추론용)"""
    collection = session.query(CollectionInfo).filter(CollectionInfo.id == collection_id).first()
    if not collection:
        return {"error": "컬렉션 없음", "inserted": 0}

    model = (
        session.query(ModelInfo)
        .filter(ModelInfo.user_id == user_id, ModelInfo.project_id == collection.project_id)
        .order_by(ModelInfo.id.desc())
        .first()
    )
    if not model:
        return {"error": "모델 없음", "inserted": 0}

    # 이미 push된 특허 제외
    already_pushed = {
        row.app_number
        for row in session.query(SdiCollection.app_number)
        .filter(SdiCollection.user_id == user_id, SdiCollection.is_pushed == 1, SdiCollection.app_number.in_(app_numbers))
        .all()
    }
    app_numbers_to_push = [n for n in app_numbers if n not in already_pushed]

    if not app_numbers_to_push:
        return {"error": "이미 모두 추가된 특허입니다.", "inserted": 0, "skipped": len(already_pushed)}

    patents = session.query(SdiNewPatent).filter(SdiNewPatent.application_number.in_(app_numbers_to_push)).all()
    if not patents:
        return {"error": "특허 없음", "inserted": 0}

    now = datetime.now()
    file_code = f"sdi_{now.strftime('%Y%m%d%H%M%S')}_{model.id}"

    file_info = FileInfo(
        user_id=user_id,
        model_id=model.id,
        model_code=model.model_code,
        file_code=file_code,
        file_name=f"SDI 신착특허 {now.strftime('%Y.%m.%d %H:%M')}",
        file_desc="SDI 신착특허 분류 추론",
        file_size=0,
        progress=0,
        progress_status=ProgressStatusType.RUNNING,
    )
    session.add(file_info)
    session.flush()

    inserted = 0
    for patent in patents:
        session.add(FileData(
            user_id=user_id,
            file_id=file_info.id,
            file_code=file_code,
            model_id=model.id,
            model_code=model.model_code,
            title=patent.title,
            abstract=patent.abstract,
            source="",
            target=collection.collection_name,
            collection_name=None,
        ))
        inserted += 1

    # is_pushed 마킹
    session.query(SdiCollection).filter(
        SdiCollection.user_id == user_id,
        SdiCollection.app_number.in_(app_numbers_to_push),
    ).update({"is_pushed": 1}, synchronize_session=False)

    session.commit()
    return {
        "file_id": file_info.id,
        "collection_id": collection_id,
        "inserted": inserted,
        "skipped": len(already_pushed),
    }


def push_to_collection_manual(session: Session, query_id: int) -> dict:
    """수동 트리거: 특정 검색식의 매칭 결과를 컬렉션에 push"""
    q = session.query(SdiSearchQuery).filter(SdiSearchQuery.id == query_id).first()
    if not q:
        return {"error": "검색식 없음", "inserted": 0}
    if not q.collection_id:
        return {"error": "연결된 컬렉션 없음", "inserted": 0}
    inserted = _push_matched_to_collection(session, q)
    return {"query_id": query_id, "collection_id": q.collection_id, "inserted": inserted}


def get_collections(session: Session, user_id: int, limit: int = 50) -> list[dict]:
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    rows = (
        session.query(SdiCollection, SdiNewPatent, SdiSearchQuery, ProjectInfo, FileInfo)
        .outerjoin(SdiNewPatent, SdiNewPatent.application_number == SdiCollection.app_number)
        .outerjoin(SdiSearchQuery, SdiSearchQuery.id == SdiCollection.query_id)
        .outerjoin(ProjectInfo, ProjectInfo.id == SdiSearchQuery.project_id)
        .outerjoin(FileInfo, FileInfo.file_code == SdiCollection.file_code)
        .filter(SdiCollection.user_id == user_id, SdiCollection.matched_datetime >= cutoff)
        .order_by(SdiCollection.matched_datetime.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": col.id,
            "query_id": col.query_id,
            "query_name": sq.query_name if sq else None,
            "project_id": sq.project_id if sq else None,
            "project_name": proj.project_name if proj else None,
            "app_number": col.app_number,
            "title": pat.title if pat else None,
            "open_date": pat.open_date if pat else None,
            "applicant_name": pat.applicant_name if pat else None,
            "ipc_code": pat.ipc_code if pat else None,
            "end_status": pat.end_status if pat else None,
            "model_class": col.model_class,
            "model_score": col.model_score,
            "is_notified": col.is_notified,
            "is_pushed": col.is_pushed,
            "file_code": col.file_code,
            "infer_job_name": fi.file_name if fi else None,
            "matched_datetime": col.matched_datetime.isoformat(),
        }
        for col, pat, sq, proj, fi in rows
    ]


def get_unread_count(session: Session, user_id: int) -> int:
    return (
        session.query(SdiCollection)
        .filter(SdiCollection.user_id == user_id, SdiCollection.is_notified == 0)
        .count()
    )


def get_total_count(session: Session, user_id: int) -> int:
    return (
        session.query(func.count(distinct(SdiCollection.query_id)))
        .filter(SdiCollection.user_id == user_id, SdiCollection.is_notified == 0)
        .scalar() or 0
    )


def mark_query_notified(session: Session, user_id: int, query_id: int) -> int:
    updated = (
        session.query(SdiCollection)
        .filter(
            SdiCollection.user_id == user_id,
            SdiCollection.query_id == query_id,
            SdiCollection.is_notified == 0,
        )
        .update({"is_notified": 1}, synchronize_session=False)
    )
    session.commit()
    return updated


def mark_all_notified(session: Session, user_id: int) -> int:
    updated = (
        session.query(SdiCollection)
        .filter(SdiCollection.user_id == user_id, SdiCollection.is_notified == 0)
        .update({"is_notified": 1}, synchronize_session=False)
    )
    session.commit()
    return updated


def sync_sdi_pushed_status(session: Session, user_id: int) -> dict:
    """infer_results 데이터 기준으로 sdi_collections.is_pushed 동기화.
    file_code 'sdi_%' 패턴과 특허 텍스트(title+abstract) 매칭으로 탐지.
    신규(sdi_q*) / 구버전(sdi_{timestamp}_*) 패턴 모두 지원.
    """
    # 1. is_pushed=0인 특허 목록 + 텍스트
    rows = session.execute(sa_text("""
        SELECT sc.id,
               TRIM(CONCAT(COALESCE(snp.title, ''), ' ', COALESCE(snp.abstract, ''))) AS input_text
        FROM sdi_collections sc
        JOIN sdi_new_patents snp ON snp.application_number = sc.app_number
        WHERE sc.user_id = :uid AND sc.is_pushed = 0
    """), {"uid": user_id}).fetchall()

    if not rows:
        return {"updated": 0, "checked": 0}

    # 2. infer_results에서 SDI 관련 텍스트 집합 (file_code LIKE 'sdi_%')
    classified = session.execute(sa_text("""
        SELECT DISTINCT input_text
        FROM infer_results
        WHERE user_id = :uid AND file_code LIKE 'sdi_%'
    """), {"uid": user_id}).fetchall()

    classified_set = {row[0] for row in classified if row[0]}

    if not classified_set:
        return {"updated": 0, "checked": len(rows)}

    # 3. 텍스트 매칭으로 pushed 대상 id 수집
    to_mark = [row.id for row in rows if row.input_text in classified_set]

    if to_mark:
        session.execute(sa_text(
            f"UPDATE sdi_collections SET is_pushed = 1 WHERE id IN ({','.join(str(i) for i in to_mark)})"
        ))
        session.commit()

    return {"updated": len(to_mark), "checked": len(rows)}


def get_run_dates(session: Session, user_id: int, query_id: int) -> list[dict]:
    """검색식의 실행 이력(날짜 + 매칭 건수) 반환. 0건 날짜도 포함."""
    rows = (
        session.query(SdiRunLog)
        .filter(SdiRunLog.user_id == user_id, SdiRunLog.query_id == query_id)
        .order_by(SdiRunLog.run_date.desc())
        .all()
    )
    return [{"run_date": r.run_date, "matched_count": r.matched_count} for r in rows]


# ───────────────────────────────────────────
# 신착특허 → infer_data 추론 INSERT
# ───────────────────────────────────────────

def push_sdi_to_inference(
    session: Session,
    user_id: int,
    project_id: int,
    model_id: Optional[int] = None,
    open_date: Optional[str] = None,
    limit: Optional[int] = None,
) -> dict:
    """신착특허를 infer_jobs + infer_data에 INSERT (분류 추론용)"""

    # 1. 프로젝트 컬렉션 목록
    collections = (
        session.query(CollectionInfo)
        .filter(CollectionInfo.user_id == user_id, CollectionInfo.project_id == project_id)
        .order_by(CollectionInfo.id)
        .all()
    )
    if not collections:
        return {"error": "컬렉션 없음", "inserted": 0}

    collection_names = [c.collection_name for c in collections]

    # 2. 모델 목록 (model_id 직접 지정 시 해당 모델만, 아니면 프로젝트 전체)
    if model_id:
        models = session.query(ModelInfo).filter(ModelInfo.id == model_id).all()
    else:
        models = (
            session.query(ModelInfo)
            .filter(ModelInfo.user_id == user_id, ModelInfo.project_id == project_id)
            .all()
        )
    if not models:
        return {"error": "모델 없음", "inserted": 0}

    # 3. 신착특허 목록
    q = session.query(SdiNewPatent)
    if open_date:
        q = q.filter(SdiNewPatent.open_date == open_date)
    if limit:
        q = q.limit(limit)
    patents = q.all()
    if not patents:
        return {"error": "신착특허 없음", "inserted": 0}

    now = datetime.now()
    file_code_base = now.strftime("%Y%m%d%H%M%S")
    total_inserted = 0

    for model in models:
        # 4. infer_jobs 생성
        file_code = f"sdi_{file_code_base}_{model.id}"
        file_info = FileInfo(
            user_id=user_id,
            model_id=model.id,
            model_code=model.model_code,
            file_code=file_code,
            file_name=f"SDI 신착특허 {now.strftime('%Y.%m.%d %H:%M')}",
            file_desc="SDI 신착특허 분류 추론",
            file_size=0,
            progress=0,
            progress_status=ProgressStatusType.RUNNING,
        )
        session.add(file_info)
        session.flush()

        # 5. infer_data INSERT (특허 × 컬렉션)
        for patent in patents:
            for col_name in collection_names:
                session.add(FileData(
                    user_id=user_id,
                    file_id=file_info.id,
                    file_code=file_code,
                    model_id=model.id,
                    model_code=model.model_code,
                    title=patent.title,
                    abstract=patent.abstract,
                    source="",
                    target=col_name,
                    collection_name=None,
                ))
                total_inserted += 1

    session.commit()
    return {
        "patents": len(patents),
        "models": len(models),
        "collections": len(collection_names),
        "inserted": total_inserted,
    }
