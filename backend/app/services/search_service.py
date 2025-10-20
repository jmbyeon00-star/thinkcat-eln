from fastapi import HTTPException

from app.utils.es_client import get_es
from app.core.config import settings
from app.crud.patent import fetch_by_keys
from app.crud.patent import (
    fetch_by_keys,
    fetch_patent_by_appnum,
    fetch_patent_by_regnum,
)
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session

import os
import traceback

# ------------------------------------------
# ⚙️ 전역 설정
# ------------------------------------------
# BGEM3 모델은 앱 시작 시 한 번만 로드 (GPU/CPU 자동 감지)
# model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "application_number")
ES_USE_VECTOR   = os.getenv("ES_USE_VECTOR", "false").lower() == "true"

_get_embedding: Optional[callable] = None
if ES_USE_VECTOR:
    try:
        from app.utils.embedding import get_embedding as _get_embedding
    except Exception:
        _get_embedding = None  # 임베딩 모듈이 없으면 벡터 검색 비활성화

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
    """매핑에 실제로 존재하는 필드만 골라준다."""
    return [f for f in candidates if f in props]


def _build_query(
    index: str,
    props: Dict,
    keyword: str,
    use_vector: bool,
    get_embedding_fn: Optional[callable],
) -> Dict:
    """
    매핑에 맞춰 should 절을 구성한다.
    1) 텍스트 검색: 존재하는 필드만 사용 (title/abstract/claims/description/quote)
    2) (선택) 벡터 검색: vector 필드가 있고, 임베딩 사용 가능하면 script_score 추가
    3) titleabstract_h일 때 미국특허 제외 스크립트 필터(주소 길이 >= 12) 옵션 적용
    """
    should_clauses: List[Dict] = []

    # --- 1) 텍스트 검색 ---
    text_candidates = ["title", "abstract", "claims", "description", "quote"]
    text_fields = _pick_available(props, text_candidates)

    if text_fields:
        boosted_fields: List[str] = []
        for f in text_fields:
            if f == "title":
                boosted_fields.append("title^3")
            elif f == "abstract":
                boosted_fields.append("abstract^2")
            else:
                boosted_fields.append(f)

        should_clauses.append({
            "multi_match": {
                "query":  keyword,
                "fields": boosted_fields
            }
        })

    # --- 2) 벡터 검색 (옵션) ---
    has_vector_field = "vector" in props
    can_vector_search = use_vector and has_vector_field and (get_embedding_fn is not None)

    if can_vector_search:
        try:
            q_vec = get_embedding_fn(keyword)  # 길이 1024 (bge-m3) 기대
        except Exception:
            q_vec = None

        if isinstance(q_vec, (list, tuple)) and len(q_vec) > 0:
            must_filters: List[Dict] = [{"match_all": {}}]

            # titleabstract_h일 때만 적용했던 "미국특허 제외" 스크립트 필터 (address 존재 시)
            if index == "titleabstract_h" and "address" in props:
                must_filters.append({
                    "script": {
                        "script": {
                            "source": "Math.log10(doc['address'].value)+1 >= 12",
                            "lang": "painless"
                        }
                    }
                })

            should_clauses.append({
                "script_score": {
                    "query": {"bool": {"must": must_filters}},
                    "script": {
                        "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                        "params": {"q": q_vec}
                    }
                }
            })

    # should가 하나도 없으면 match_all로라도 반환
    if not should_clauses:
        return {"match_all": {}}
    return {"bool": {"should": should_clauses}}

def search_patents(session: Session, section: str, keyword: str, page: int, size: int) -> Tuple[int, List[Dict], List[Dict]]:
    """
        섹션(카테고리)별 동적 인덱스 검색.
        - 인덱스: f"{ES_INDEX_PREFIX}{section}"
        - 매핑을 읽어 실제 존재하는 필드만 쿼리에 사용
        - (옵션) ES_USE_VECTOR=true + embedding 모듈 있을 때 vector 검색 병행
        - 결과 형태는 기존과 동일하게 (total, hits, data) 반환
    """
    try:
        es = get_es()
        index = f"{ES_INDEX_PREFIX}{section}"

        # 컬럼명 확인용
        # mapping = es.indices.get_mapping(index=index)
        # props = mapping[index]
        # print(props)

        # 인덱스 없으면 바로 빈 결과
        if not es.indices.exists(index=index):
            return 0, [], []
        
        # 매핑 확인
        props = _get_index_properties(es, index)

        # _source (있는 필드만 요청)
        source_candidates = [ES_KEY_FIELD, "quote", "vector"]
        source_fields = _pick_available(props, source_candidates)
        if ES_KEY_FIELD not in source_fields:
            source_fields.insert(0, ES_KEY_FIELD)  # 키 필드는 최우선 포함 시도

        # highlight (있는 필드만)
        highlight_fields: Dict[str, Dict] = {}
        if "title" in props:
            highlight_fields["title"] = {"number_of_fragments": 0}
        if "abstract" in props:
            highlight_fields["abstract"] = {"fragment_size": 140, "no_match_size": 140}
        if "quote" in props:
            # 길게 받으려면 number_of_fragments:0, 아니면 fragment_size로 조절
            highlight_fields["quote"] = {"number_of_fragments": 0}

        # 쿼리 구성
        query = _build_query(
            index=index,
            props=props,
            keyword=keyword,
            use_vector=ES_USE_VECTOR,
            get_embedding_fn=_get_embedding,
        )
        
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
        
        # 검색
        res = es.search(index=index, body=body)  # ES 7.x 스타일(7.x는 body= 사용)
        total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]
        hits_raw = res.get("hits", {}).get("hits", [])

        # 1차 결과(hits)
        order_keys: List[str] = []
        # hits: List[Dict] = []
        es_map: Dict[str, Dict] = {}
        for h in hits_raw:
            src = h.get("_source") or {}
            k = src.get(ES_KEY_FIELD)
            if not k:
                continue
            order_keys.append(k)
            es_map[str(k)] = {
                "vector": src.get("vector"),
                "score": h.get("_score"),
                "title_es": src.get("title") or src.get("quote"),
                "abstract_es": src.get("abstract") or src.get("quote"),
            }
        
        words = keyword.strip().split()
        if len(words) == 1:
            words = words[0]
        elif len(words) == 2:
            words =  words[0]
        elif len(words) >= 3:
            words = " ".join(words[:2])
        
        # 2차: RDB에서 상세 붙이기
        results: List[Dict] = []
        if order_keys:
            rows = fetch_by_keys(session, order_keys)
            for r in rows:
                k = str(r.get(ES_KEY_FIELD) or r.get("application_number"))
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
                    "collection_name": words
                })
        return int(total), es_map, results
    
    except Exception as e:
        print("ERROR:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------
# 🔍 키워드 검색 (BGEM3 + Elasticsearch)
# ------------------------------------------
def search_by_keyword(
    session: Session,
    section: str,
    keyword: str,
    page: int,
    size: int,
) -> Tuple[int, List[Dict], List[Dict]]:
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
        if "title" in props:
            highlight_fields["title"] = {"number_of_fragments": 0}
        if "abstract" in props:
            highlight_fields["abstract"] = {"fragment_size": 140, "no_match_size": 140}
        if "quote" in props:
            # 길게 받으려면 number_of_fragments:0, 아니면 fragment_size로 조절
            highlight_fields["quote"] = {"number_of_fragments": 0}


        # # 키워드 임베딩
        # embedding = model.encode(keyword, batch_size=12, max_length=1024)
        # dense_vec = embedding["dense_vecs"][0].tolist()
        
        # # ES 검색 쿼리
        # body = {
        #     "track_total_hits": True,
        #     "from": (page - 1) * size,
        #     "size": size,
        #     "_source": ["address", "quote"],
        #     "query": {
        #         "script_score": {
        #             "query": {"match_all": {}},
        #             "script": {
        #                 "source": "cosineSimilarity(params.vector, 'vector') + 1.0",
        #                 "params": {"vector": dense_vec},
        #             },
        #         }
        #     },
        #     "highlight": {
        #         "pre_tags": ["<mark>"],
        #         "post_tags": ["</mark>"],
        #         "fields": {"quote": {"number_of_fragments": 0}},
        #     },
        # }

        # 쿼리 구성
        query = _build_query(
            index=index,
            props=props,
            keyword=keyword,
            use_vector=ES_USE_VECTOR,
            get_embedding_fn=_get_embedding,
        )

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

        # res = es.search(index=index, body=body, request_timeout=60)
        res = es.search(index=index, body=body)
        total = res["hits"]["total"]["value"]
        hits_raw = res["hits"]["hits"]
        hits: List[Dict] = []
        order_keys: List[str] = []

        for h in hits_raw:
            src = h.get("_source") or {}
            app_num = str(src.get("address"))
            if not app_num:
                continue
            order_keys.append(app_num)
            hits.append({
                "key": app_num,
                "title": src.get("quote"),
                "abstract": src.get("quote"),
                "score": h.get("_score"),
                "highlight": h.get("highlight", {}),
            })

        data: List[Dict] = []
        if order_keys:
            rows = fetch_by_keys(session, order_keys)
            for r in rows:
                data.append({
                    "application_number": r.get("application_number"),
                    "title": r.get("title") or "",
                    "abstract": r.get("abstract") or "",
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                })
        return int(total), hits, data

    except Exception as e:
        print("❌ ES SEARCH ERROR:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ------------------------------------------
# 📄 출원번호 검색
# ------------------------------------------
def search_by_application(session: Session, app_num: str) -> Dict:
    return fetch_patent_by_appnum(session, app_num) or {}


# ------------------------------------------
# 🧾 등록번호 검색
# ------------------------------------------
def search_by_registration(session: Session, reg_num: str) -> Dict:
    return fetch_patent_by_regnum(session, reg_num) or {}