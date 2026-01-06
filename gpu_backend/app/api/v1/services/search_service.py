from fastapi import HTTPException
from typing import Tuple, List, Dict, Optional, Optional, Any
from pymysql.connections import Connection
from pymysql.cursors import Cursor, DictCursor

from app.utils.db_connecter import db_connect
from app.utils.es_client import get_es


import os
import traceback

# ------------------------------------------
# ⚙️ 전역 설정
# ------------------------------------------
# BGEM3 모델은 앱 시작 시 한 번만 로드 (GPU/CPU 자동 감지)
# model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "address")
ES_USE_VECTOR   = os.getenv("ES_USE_VECTOR", "false").lower() == "true"

_get_embedding: Optional[callable] = None
if ES_USE_VECTOR:
    try:
        from app.utils.embedding import get_embedding as _get_embedding
    except Exception:
        _get_embedding = None  # 임베딩 모듈이 없으면 벡터 검색 비활성화

# ------------------------------------------
# 🔧 내부 헬퍼 함수
# ------------------------------------------
def _get_index_properties(es, index: str) -> Dict:
    """
    인덱스 매핑에서 properties만 뽑아온다. 인덱스가 없거나 오류면 빈 dict 반환.
    """
    try:
        if not es.indices.exists(index=index):
            return {}
        m = es.indices.get_mapping(index=index)
        return m.get(index, {}).get("mappings", {}).get("properties", {}) or {}
    except Exception:
        return {}


def _pick_available(props: Dict, candidates: List[str]) -> List[str]:
    """매핑에 실제 존재하는 필드만 반환"""
    return [f for f in candidates if f in props]

def _build_query(
    index: str,
    props: Dict,
    keyword: str,
    use_vector: bool,
    get_embedding_fn: Optional[callable],
) -> Dict:
    """ES 검색 쿼리 구성 (텍스트 + 벡터 옵션 포함)"""
    should_clauses: List[Dict] = []

    # 1) 텍스트 검색
    text_candidates = ["title", "abstract", "claims", "description", "quote"]
    text_fields = _pick_available(props, text_candidates)
    if text_fields:
        boosted = []
        for f in text_fields:
            if f == "title":
                boosted.append("title^3")
            elif f == "abstract":
                boosted.append("abstract^2")
            else:
                boosted.append(f)
        should_clauses.append({"multi_match": {"query": keyword, "fields": boosted}})

    # 2) 벡터 검색
    has_vector_field = "vector" in props
    can_vector_search = use_vector and has_vector_field and get_embedding_fn is not None

    if can_vector_search:
        try:
            q_vec = get_embedding_fn(keyword)
        except Exception:
            q_vec = None

        if isinstance(q_vec, (list, tuple)) and len(q_vec) > 0:
            should_clauses.append({
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                        "params": {"q": q_vec}
                    }
                }
            })

    if not should_clauses:
        return {"match_all": {}}
    return {"bool": {"should": should_clauses}}


# ------------------------------------------
# 📄 출원번호 검색
# ------------------------------------------
# def search_by_application(session: Session, app_num: str) -> Dict:
#     return fetch_patent_by_appnum(session, app_num) or {}


# ------------------------------------------
# 🧾 등록번호 검색
# ------------------------------------------
# def search_by_registration(session: Session, reg_num: str) -> Dict:
#     return fetch_patent_by_regnum(session, reg_num) or {}


# ------------------------------------------
# 🔍 키워드 검색 (MySQL + ES) (BGEM3 + Elasticsearch)
# ------------------------------------------
def search_by_keyword(
    section: str,
    keyword: str,
    page: int,
    size: int
) -> Tuple[int, List[Dict], List[Dict]]:
    """
    ES + MySQL 통합 검색
    """
    connection, cursor = db_connect()
    try:
        es = get_es()
        index = f"{ES_INDEX_PREFIX}{section.lower()}"

        if not es.indices.exists(index=index):
            return 0, [], []

        props = _get_index_properties(es, index)
        source_candidates = [ES_KEY_FIELD, "quote", "vector"]
        source_fields = _pick_available(props, source_candidates)
        if ES_KEY_FIELD not in source_fields:
            source_fields.insert(0, ES_KEY_FIELD)

        highlight_fields: Dict[str, Dict] = {}
        for f in ["title", "abstract", "quote"]:
            if f in props:
                highlight_fields[f] = {"number_of_fragments": 0}

        query = _build_query(index, props, keyword, ES_USE_VECTOR, _get_embedding)
        body = {
            "track_total_hits": True,
            "from": (page - 1) * size,
            "size": size,
            "_source": source_fields,
            "query": query,
            "highlight": {
                "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
                "fields": highlight_fields
            }
        }

        res = es.search(index=index, body=body)
        total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]
        hits_raw = res["hits"]["hits"]

        # 1차 ES 결과
        order_keys: List[str] = []
        es_map: Dict[str, Dict] = {}
        hits: List[Dict] = []
        for h in hits_raw:
            src = h.get("_source") or {}
            k = str(src.get(ES_KEY_FIELD) or "")
            if not k:
                continue
            order_keys.append(k)
            es_map[k] = {
                "key": k,
                "vector": src.get("vector"),
                # "score": h.get("_score"),
                # "score": round(h.get("_score") or 0, 4),
                "score": float(h.get("_score")) if h.get("_score") is not None else None,
                "title_es": src.get("title") or src.get("quote"),
                "abstract_es": src.get("abstract") or src.get("quote"),
            }
            hits.append({
                "key": k,
                "score": h.get("_score"),
                "highlight": h.get("highlight", {}),
                "title": src.get("title") or src.get("quote"),
                "abstract": src.get("abstract") or src.get("quote"),
            })

        # 2차 MySQL 조회
        results: List[Dict] = []
        if order_keys:
            rows = fetch_by_keys(connection, cursor, order_keys)
            words = keyword.strip().split()
            label = words[0] if len(words) == 1 else " ".join(words[:2])

            for r in rows:
                k = str(r.get("application_number"))
                es_info = es_map.get(k, {})
                results.append({
                    "application_number": r.get("application_number"),
                    "title": r.get("title") or es_info.get("title_es"),
                    "abstract": r.get("abstract") or es_info.get("abstract_es"),
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                    "vector": es_info.get("vector"),
                    "score": es_info.get("score"),
                    "cpc_code": r.get("cpc_code"),
                    "collection_name": label,
                })
        
        print(f"검색어 {keyword}, 결과: {total}개, DB 조회결과: {len(results)}개")
        return int(total), list(es_map.values()), results #hits, results

    except Exception as e:
        print("❌ SEARCH ERROR:", e)
        # traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass

# ------------------------------------------
# 🧩 MySQL 보조 함수들
# ------------------------------------------
def fetch_by_keys(connection: Connection, cursor: DictCursor, keys: List[str]) -> List[Dict[str, Any]]:
    if not keys:
        return []

    placeholders = ', '.join(['%s'] * len(keys))
    sql = f"""
        SELECT application_number, title, abstract, filing_date, grant_date, cpc_code, ipc_code
        FROM PATENT_RESULT_TB
        WHERE application_number IN ({placeholders})
    """
    cursor.execute(sql, tuple(keys))
    rows = cursor.fetchall()

    out = []
    for r in rows:
        out.append({
            "application_number": r["application_number"],
            "title": r.get("title"),
            "abstract": r.get("abstract"),
            "filing_date": r.get("filing_date"),
            "grant_date": r.get("grant_date"),
            "cpc_code": (r.get("cpc_code") or "").split('|')[0][:4],
            "ipc_code": (r.get("ipc_code") or "").split('|')[0][:4],
        })
    return out

def fetch_patent_by_appnum(application_number: str) -> Optional[Dict]:
    connection, cursor = db_connect()
    try:
        sql = """
            SELECT *
            FROM PATENT_RESULT_TB
            WHERE application_number = %s
        """
        cursor.execute(sql, (application_number,))
        return cursor.fetchone()
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass

def fetch_patent_by_regnum(reg_number: str) -> Dict[str, Any]:
    """
    등록번호(reg_number)로 특허 단건 조회 (MySQL)
    """
    connection, cursor = db_connect()
    try:
        sql = """
            SELECT
                reg_number,
                application_number,
                title,
                abstract,
                filing_date,
                grant_date,
                cpc_code,
                ipc_code
            FROM PATENT_RESULT_TB
            WHERE reg_number = %s
            LIMIT 1
        """
        cursor.execute(sql, (reg_number,))
        row = cursor.fetchone()

        if not row:
            return {}

        return {
            "reg_number": row.get("reg_number"),
            "application_number": row.get("application_number"),
            "title": row.get("title"),
            "abstract": row.get("abstract"),
            "filing_date": row.get("filing_date"),
            "grant_date": row.get("grant_date"),
            "cpc_code": (row.get("cpc_code") or "").split("|")[0][:4],
            "ipc_code": (row.get("ipc_code") or "").split("|")[0][:4],
        }

    except Exception as e:
        print("❌ fetch_patent_by_regnum ERROR:", e)
        return {}
    finally:
        try:
            cursor.close()
            connection.close()
        except:
            pass