from fastapi import HTTPException
# from app.utils.es_client import get_es
from app.utils.os_client import get_os
from app.crud.patent import (fetch_by_keys, fetch_patent_by_regnum, fetch_by_applicant)
from app.utils.embedding import get_embedding
from app.utils.db_connecter import db_connect
from pymysql.connections import Connection
from pymysql.cursors import Cursor, DictCursor
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session
import os
import traceback


# ------------------------------------------
# ⚙️ 전역 설정
# ------------------------------------------
# ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
# ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "application_number")
ES_INDEX_PREFIX = os.getenv("OPENSEARCH_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("OPENSEARCH_KEY_FIELD", "application_number")

# ------------------------------------------
# 🗄️ 검색 캐시 (임베딩 & total_hits 저장)
# ------------------------------------------
_search_cache: Dict[str, Dict] = {}


def clear_search_cache():
    """
    전체 검색 캐시 삭제
    """
    global _search_cache
    cache_count = len(_search_cache)
    _search_cache.clear()
    print(f"🗑️ 캐시 전체 삭제 완료 ({cache_count}개 삭제됨)")
    return {"message": f"{cache_count}개의 캐시가 삭제되었습니다."}


def clear_cache_by_key(section: str, keyword: str, search_method: str):
    """
    특정 검색 캐시만 삭제
    """
    cache_key = f"{section.lower()}:{keyword}:{search_method}"
    if cache_key in _search_cache:
        del _search_cache[cache_key]
        print(f"🗑️ 캐시 삭제: {cache_key}")
        return {"message": f"캐시가 삭제되었습니다: {cache_key}"}
    else:
        return {"message": "해당 캐시가 존재하지 않습니다."}


def get_cache_info():
    """
    현재 캐시 정보 조회
    """
    cache_list = []
    for key, value in _search_cache.items():
        parts = key.split(":")
        cache_list.append({
            "cache_key": key,
            "section": parts[0] if len(parts) > 0 else "",
            "keyword": parts[1] if len(parts) > 1 else "",
            "method": parts[2] if len(parts) > 2 else "",
            "total_hits": value.get("total_hits", 0),
            "vector_size": len(value.get("vector", []))
        })
    
    return {
        "total_cache_count": len(_search_cache),
        "caches": cache_list
    }


def get_total_hits(es, index: str, inquiry_vector: List[float] = None) -> int:
    """
    전체 매칭 문서 수를 가져옵니다 (결과는 가져오지 않음)

    Args:
        es: OpenSearch 클라이언트
        index: 검색할 인덱스명
        inquiry_vector: (미사용) 구 ES script_score 방식에서 사용하던 벡터 — OpenSearch count API로 대체됨

    Returns:
        전체 매칭 문서 수
    """
    # # [ES] script_score 방식으로 전체 문서 수 조회
    # body = {
    #     "query": {
    #         "script_score": {
    #             "query": {"match_all": {}},
    #             "script": {
    #                 "source": "cosineSimilarity(params.inQuiry_vector, 'vector') + 1.0",
    #                 "params": {"inQuiry_vector": inquiry_vector}
    #             }
    #         }
    #     },
    #     "size": 0,
    #     "track_total_hits": True
    # }
    # response = es.search(index=index, body=body, request_timeout=120)
    # total_hits = response['hits']['total']['value']

    # [OpenSearch] count API로 인덱스 전체 문서 수 조회
    response = es.count(index=index, body={"query": {"match_all": {}}})
    total_hits = response['count']

    print(f"📊 총 유사 문서 수: {total_hits}")
    return total_hits


def search_patents_with_pagination(
    section: str,
    keyword: str,
    page: int = 1,
    page_size: int = 10,
    search_method: str = "bgem3",
    include_vector: bool = False,
    include_quote: bool = True
) -> Dict:
    """
    페이지네이션 기반 특허 검색
    
    Args:
        session: DB 세션
        section: 카테고리 (h, g, a, b, c, d, e, f)
        keyword: 검색 키워드
        page: 페이지 번호 (1부터 시작)
        page_size: 페이지당 결과 수 (기본 10, 최대 100)
        search_method: 검색 방법 ('bgem3' 또는 'mlt')
        include_vector: 벡터 포함 여부 (기본 False, 성능 향상)
        include_quote: quote 필드 포함 여부 (기본 True)
    
    Returns:
        {
            "total_hits": 전체 매칭 문서 수,
            "max_size": 실제로 가져올 수 있는 최대 문서 수,
            "page": 현재 페이지,
            "page_size": 페이지 크기,
            "total_pages": 전체 페이지 수,
            "has_next": 다음 페이지 존재 여부,
            "has_prev": 이전 페이지 존재 여부,
            "data": 검색 결과 리스트,
            "hits": ES 원본 결과
        }
    """
    try:
        # es = get_es()
        es = get_os()
        index = f"{ES_INDEX_PREFIX}{section.lower()}"
        
        # 인덱스 존재 확인
        if not es.indices.exists(index=index):
            print(f"⚠️ 인덱스가 존재하지 않음: {index}")
            return {
                "total_hits": 0,
                "max_size": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
                "has_next": False,
                "has_prev": False,
                "data": [],
                "hits": []
            }
        
        # 페이지 크기 제한 (최대 100)
        page_size = min(page_size, 100)
        
        # ------------------------------------------
        # 🗄️ 캐시 키 생성 및 확인
        # ------------------------------------------
        cache_key = f"{section.lower()}:{keyword}:{search_method}"
        
        if cache_key in _search_cache:
            # 캐시에서 가져오기
            cached = _search_cache[cache_key]
            inquiry_vector = cached['vector']
            total_hits = cached['total_hits']
            print(f"✅ 캐시 사용 - 임베딩 스킵! (키: {cache_key})")
        else:
            # 새로운 검색 - 임베딩 및 total_hits 조회
            print(f"🔍 검색 시작 - 키워드: {keyword}, 섹션: {section}, 페이지: {page}")
            inquiry_vector = get_embedding(keyword)
            print(f"✅ 임베딩 완료 - 벡터 차원: {len(inquiry_vector)}")
            
            total_hits = get_total_hits(es, index, inquiry_vector)
            
            # 캐시 저장 (최근 100개만 유지)
            if len(_search_cache) > 100:
                print(f"🗑️ 캐시 초과 - 전체 삭제")
                _search_cache.clear()
            
            _search_cache[cache_key] = {
                'vector': inquiry_vector,
                'total_hits': total_hits
            }
            print(f"💾 캐시 저장 완료 (총 {len(_search_cache)}개 캐시)")
        
        # ------------------------------------------
        # 📊 페이지네이션 계산
        # ------------------------------------------
        # total_hits가 1000 이상이면 ES 제한으로 최대 1000개만 가져올 수 있음
        if total_hits >= 1000:
            max_size = 1000
            print(f"⚠️ 결과가 1000개 이상 ({total_hits}개) → 최대 1000개로 제한")
        else:
            max_size = total_hits
            print(f"✅ 전체 결과 수: {max_size}개")
        
        # 페이지네이션 from 계산
        from_ = (page - 1) * page_size
        
        # 최대 크기를 초과하지 않도록 체크
        if from_ >= max_size:
            print(f"⚠️ 페이지 범위 초과 - from: {from_}, max_size: {max_size}")
            total_pages = (max_size + page_size - 1) // page_size
            return {
                "total_hits": total_hits,
                "max_size": max_size,
                "page": page,
                "page_size": page_size,
                "total_pages": total_pages,
                "has_next": False,
                "has_prev": page > 1,
                "data": [],
                "hits": []
            }
        
        # 실제로 가져올 크기 조정
        actual_size = min(page_size, max_size - from_)
        print(f"📄 from: {from_}, size: {actual_size}")
        
        # ------------------------------------------
        # 🔎 ES 쿼리 구성
        # ------------------------------------------
        if search_method == "bgem3":
            # # [ES] script_score 방식
            # query = {
            #     "script_score": {
            #         "query": {"match_all": {}},
            #         "script": {
            #             "source": "cosineSimilarity(params.inQuiry_vector, 'vector') + 1.0",
            #             "params": {"inQuiry_vector": inquiry_vector}
            #         }
            #     }
            # }
            # [OpenSearch] knn 쿼리 방식
            query = {
                "knn": {
                    "vector": {
                        "vector": inquiry_vector,
                        "k": min(max_size, 1000)
                    }
                }
            }
        elif search_method == "mlt":
            query = {
                "more_like_this": {
                    "fields": ["quote"],
                    "like": keyword,
                    "min_term_freq": 1,
                    "max_query_terms": 50,
                    "min_doc_freq": 1
                }
            }
        else:
            raise HTTPException(
                status_code=400, 
                detail="Invalid search_method. Use 'bgem3' or 'mlt'"
            )
        
        # ------------------------------------------
        # 🔎 ES 검색 실행
        # ------------------------------------------
        # _source 필드 동적 구성
        source_fields = ["address"]  # address는 필수
        if include_vector:
            source_fields.append("vector")
        if include_quote:
            source_fields.append("quote")
        
        print(f"📦 가져올 필드: {source_fields}")
        
        body = {
            "query": query,
            "from": from_,
            "size": actual_size,
            "track_total_hits": True,
            "_source": source_fields
        }
        
        print(f"🔎 ES 검색 실행 중... (method: {search_method})")
        response = es.search(index=index, body=body, request_timeout=120)
        print(f"✅ ES 검색 완료")
        
        # ------------------------------------------
        # 📋 결과 파싱
        # ------------------------------------------
        hits_raw = response['hits']['hits']
        order_keys: List[str] = []
        hits: List[Dict] = []
        
        for h in hits_raw:
            src = h.get("_source", {})
            
            # address 필드에서 출원번호 가져오기
            app_num = str(src.get("address", ""))
            
            # None이나 빈 문자열 체크
            if not app_num or app_num == "None":
                continue
            
            # quote 분리 (title;abstract 형식)
            quote = src.get("quote", "")
            parts = quote.split(";") if quote else []
            title_es = parts[0].strip() if len(parts) > 0 else ""
            abstract_es = parts[1].strip() if len(parts) > 1 else ""
            
            order_keys.append(app_num)
            hits.append({
                "application_number": app_num,
                "score": h.get("_score"),
                "vector": src.get("vector"),
                "title_es": title_es,
                "abstract_es": abstract_es
            })
        
        print(f"📋 파싱된 결과: {len(hits)}개")
        
        # ------------------------------------------
        # 🗄️ RDB 상세 정보 병합
        # ------------------------------------------
        connection, cursor = db_connect()
        data: List[Dict] = []
        if order_keys:
            print(f"🗄️ RDB에서 상세 정보 조회 중...")
            rows = fetch_by_keys(connection, cursor, order_keys)
            row_map = {str(r.get("application_number")): r for r in rows}
            
            # 순서 유지하면서 병합
            for hit in hits:
                app_num = hit["application_number"]
                r = row_map.get(app_num, {})
                
                data.append({
                    "application_number": app_num,
                    "title": r.get("title") or hit.get("title_es", ""),
                    "abstract": r.get("abstract") or hit.get("abstract_es", ""),
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                    "cpc_code": r.get("cpc_code"),
                    "score": hit["score"]
                })
            
            print(f"✅ RDB 병합 완료: {len(data)}개")
        
        # ------------------------------------------
        # 📦 응답 데이터 구성
        # ------------------------------------------
        total_pages = (max_size + page_size - 1) // page_size
        has_next = page < total_pages
        has_prev = page > 1
        
        result = {
            "total_hits": total_hits,
            "max_size": max_size,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": has_next,
            "has_prev": has_prev,
            "data": data,
            "hits": hits
        }
        
        print(f"🎉 검색 완료 - 페이지 {page}/{total_pages}")
        return result
    
    except Exception as e:
        print(f"❌ 검색 오류: {e}")
        print(traceback.print_exc())
        raise HTTPException(status_code=500, detail=str(e))


def search_with_both_methods(
    session: Session,
    section: str,
    keyword: str,
    page: int = 1,
    page_size: int = 10,
    include_vector: bool = False,
    include_quote: bool = True
) -> Dict:
    print("????")
    """
    BGE-M3와 MLT 두 가지 방법으로 동시 검색
    
    Args:
        session: DB 세션
        section: 카테고리
        keyword: 검색 키워드
        page: 페이지 번호
        page_size: 페이지당 결과 수
        include_vector: 벡터 포함 여부
        include_quote: quote 필드 포함 여부
    
    Returns:
        {
            "bgem3": {...},
            "mlt": {...}
        }
    """
    try:
        print(f"🔄 듀얼 검색 시작 - BGE-M3 + MLT")
        
        bgem3_result = search_patents_with_pagination(
            section=section,
            keyword=keyword,
            page=page,
            page_size=page_size,
            search_method="bgem3",
            include_vector=include_vector,
            include_quote=include_quote
        )
        
        mlt_result = search_patents_with_pagination(
            section=section,
            keyword=keyword,
            page=page,
            page_size=page_size,
            search_method="mlt",
            include_vector=include_vector,
            include_quote=include_quote
        )
        
        print(f"✅ 듀얼 검색 완료")
        
        return {
            "bgem3": bgem3_result,
            "mlt": mlt_result
        }
    
    except Exception as e:
        print(f"❌ 듀얼 검색 오류: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))