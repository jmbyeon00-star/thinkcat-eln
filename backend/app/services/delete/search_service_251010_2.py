# app/services/search_service.py
from typing import Tuple, List, Dict, Optional
from sqlalchemy.orm import Session
from elasticsearch import Elasticsearch
from FlagEmbedding import BGEM3FlagModel

import os
import json

from app.utils.es_client import get_es
from app.models.patent_model import PatentResult
from app.crud.patent import fetch_by_keys

ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "application_number")
ES_URL = os.getenv("ES_URL", "http://192.168.1.116:9200")


class SearchService:
    """🔍 Patent Search Service — 통합 검색 서비스 (DB / ES / BGEM3)"""

    def __init__(self, session: Session):
        self.db = session
        self.es = get_es()
        self.model = None  # BGEM3 모델은 필요 시 로드

    # ------------------------------------------
    # ✅ 일반 텍스트 검색 (Elasticsearch)
    # ------------------------------------------
    def search_patents(
        self,
        section: str,
        keyword: str,
        page: int = 1,
        size: int = 10,
    ) -> Tuple[int, List[Dict], List[Dict]]:
        """기존 텍스트 검색 (Elasticsearch 전용)"""
        index = f"{ES_INDEX_PREFIX}{section}"

        if not self.es.indices.exists(index=index):
            return 0, [], []

        query = {
            "multi_match": {
                "query": keyword,
                "fields": ["title^3", "abstract^2", "claims", "description"],
            }
        }

        body = {
            "track_total_hits": True,
            "from": (page - 1) * size,
            "size": size,
            "_source": [ES_KEY_FIELD, "title", "abstract"],
            "query": query,
            "highlight": {
                "pre_tags": ["<mark>"],
                "post_tags": ["</mark>"],
                "fields": {
                    "title": {"number_of_fragments": 0},
                    "abstract": {"fragment_size": 140, "no_match_size": 140},
                },
            },
        }

        res = self.es.search(index=index, body=body)
        total = res["hits"]["total"]["value"]
        hits_raw = res["hits"]["hits"]

        es_map = {}
        order_keys = []
        for h in hits_raw:
            src = h["_source"]
            k = src.get(ES_KEY_FIELD)
            if not k:
                continue
            order_keys.append(k)
            es_map[str(k)] = {
                "score": h.get("_score"),
                "title": src.get("title"),
                "abstract": src.get("abstract"),
                "highlight": h.get("highlight"),
            }

        results = []
        if order_keys:
            rows = fetch_by_keys(self.db, order_keys)
            for r in rows:
                k = str(r.get("application_number"))
                es_info = es_map.get(k, {})
                results.append({
                    "application_number": r.get("application_number"),
                    "title": r.get("title") or es_info.get("title"),
                    "abstract": r.get("abstract") or es_info.get("abstract"),
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                })

        return total, es_map, results

    # ------------------------------------------
    # ✅ BGEM3 + MLT 검색 (벡터 & 유사도)
    # ------------------------------------------
    def search_bgem3_and_mlt(
        self, category: str, keyword: str, maxsize: int = 1000
    ) -> Dict[str, List[Dict]]:
        """BGEM3 모델 기반 벡터 검색 + MLT 검색"""
        es = Elasticsearch(ES_URL)
        index = f"titleabstract_{category.strip().lower()}"

        # BGEM3 모델 초기화 (lazy load)
        if self.model is None:
            self.model = BGEM3FlagModel("BAAI/bge-m3", use_fp16=True)

        emb = self.model.encode(keyword, batch_size=12, max_length=1024)
        vec = emb["dense_vecs"].tolist()

        queries = {
            "bgem3": {
                "script_score": {
                    "query": {"match_all": {}},
                    "script": {
                        "source": "cosineSimilarity(params.q, 'vector') + 1.0",
                        "params": {"q": vec},
                    },
                }
            },
            "mlt": {
                "more_like_this": {
                    "fields": ["quote"],
                    "like": keyword,
                    "min_term_freq": 1,
                    "max_query_terms": 50,
                    "min_doc_freq": 1,
                }
            },
        }

        result = {"bgem3": [], "mlt": []}
        for kind, query in queries.items():
            res = es.search(
                index=index,
                body={"query": query, "size": maxsize, "_source": ["address", "title", "abstract"]},
            )
            for h in res["hits"]["hits"]:
                src = h["_source"]
                result[kind].append({
                    "application_number": str(src.get("address")),
                    "title": src.get("title"),
                    "abstract": src.get("abstract"),
                    "score": h["_score"],
                })

        # DB 데이터와 병합
        merged = {}
        for key, rows in result.items():
            keys = [r["application_number"] for r in rows]
            db_rows = fetch_by_keys(self.db, keys)
            merged[key] = [
                {
                    **r,
                    "score": next(
                        (x["score"] for x in rows if x["application_number"] == r["application_number"]),
                        None,
                    ),
                }
                for r in db_rows
            ]

        return merged

    # ------------------------------------------
    # ✅ DB 직접 조회 (출원번호 / 등록번호)
    # ------------------------------------------
    def search_by_application(self, application_number: str) -> Optional[Dict]:
        """출원번호 단건 조회"""
        row = (
            self.db.query(PatentResult)
            .filter(PatentResult.application_number == application_number)
            .first()
        )
        return row.to_dict() if row else None

    def search_by_registration(self, reg_number: str) -> Optional[Dict]:
        """등록번호 단건 조회"""
        row = (
            self.db.query(PatentResult)
            .filter(PatentResult.reg_number == reg_number)
            .first()
        )
        return row.to_dict() if row else None
