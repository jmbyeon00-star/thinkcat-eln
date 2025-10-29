from typing import Tuple, List, Dict
from sqlalchemy.orm import Session
import os

from app.utils.es_client import get_es
from app.crud.patent import fetch_by_keys

ES_INDEX_PREFIX = os.getenv("ES_INDEX_PREFIX", "titleabstract_")
ES_KEY_FIELD = os.getenv("ES_KEY_FIELD", "application_number")

def search_patents(session: Session, section: str, keyword: str, page: int, size: int) -> Tuple[int, List[Dict], List[Dict]]:
    es = get_es()
    index = f"{ES_INDEX_PREFIX}{section}"
    body = {
        "track_total_hits": True,
        "from": (page - 1) * size,
        "size": size,
        "_source": [ES_KEY_FIELD, "title", "abstract", "cpc_section"],
        "query": { "multi_match": { "query": keyword, "fields": ["title^3","abstract^2","claims","description"] } },
        "highlight": {
            "pre_tags": ["<mark>"], "post_tags": ["</mark>"],
            "fields": { "title": {"number_of_fragments":0}, "abstract": {"fragment_size":140,"no_match_size":140} }
        }
    }
    res = es.search(index=index, body=body)  # 7.x는 body= 사용
    total = res["hits"]["total"]["value"] if isinstance(res["hits"]["total"], dict) else res["hits"]["total"]
    hits_raw = res.get("hits", {}).get("hits", [])
    
    order_keys, hits = [], []
    for h in hits_raw:
        src = h.get("_source") or {}
        k = src.get(ES_KEY_FIELD)
        if not k: 
            continue
        order_keys.append(k)
        hits.append({
            "key": k,
            "title": src.get("title"),
            "abstract": src.get("abstract"),
            "score": h.get("_score"),
            "highlight": h.get("highlight"),
        })

    data = []
    if order_keys:
        rows = fetch_by_keys(session, order_keys)
        # rows에 ES_KEY_FIELD 또는 official_number가 들어있음
        row_map = { r.get(ES_KEY_FIELD) or r.get("official_number"): r for r in rows }
        for k in order_keys:
            r = row_map.get(k)
            if r:
                data.append({
                    "official_number": r.get("official_number"),
                    "title": r.get("title"),
                    "abstract": r.get("abstract"),
                    "filing_date": r.get("filing_date"),
                    "grant_date": r.get("grant_date"),
                })
    return int(total), hits, data
