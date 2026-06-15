"""
neo4j_service.py
- Neo4j 벡터 인덱스 워밍업
- 검색 / 출원인 유사도 / 특허 네비게이션 통합
"""

from __future__ import annotations

import logging
import os
import threading
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from neo4j import GraphDatabase
from sklearn.preprocessing import MinMaxScaler


from app.utils.embedding import get_embedding
logger = logging.getLogger(__name__)


from datetime import date as date_cls
def _parse_filing_date(filing_date) -> str:
    if filing_date is None:
        return None
    if isinstance(filing_date, str):
        return filing_date[:10]
    if isinstance(filing_date, dict):
        year  = filing_date.get('_Date__year')
        month = filing_date.get('_Date__month')
        day   = filing_date.get('_Date__day')
        if day is None or day < 1:
            day = 1
        try:
            return date_cls(year, month, day).strftime('%Y-%m-%d')
        except Exception:
            return f"{year}-{month:02d}-??"
    return str(filing_date)

def _parse_cpc_code(cpc_list) -> str:
    if not cpc_list:
        return ''
    main   = [c['code'] for c in cpc_list if c.get('is_main') is True]
    others = sorted([c['code'] for c in cpc_list if c.get('is_main') is not True])
    return ' | '.join(main + others)



# ----------------------------------------
# 상수
# ----------------------------------------
SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'Y']
WARMUP_VECTOR = [0.0] * 1024
WARMUP_TOPK = 1



# ----------------------------------------
# Neo4jSearchService
# ----------------------------------------
class Neo4jSearchService:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))
        self._search_cache: Dict[str, List[float]] = {}
        self._warmup_done = False
        self._warmup_lock = threading.Lock()
        
    def close(self):
        self.driver.close()
        
    # --- 연결 확인 ------------------------
    def check_connection(self) -> int:
        with self.driver.session() as session:
            result = session.run(
                "MATCH (n:Patent) RETURN count(n) AS count"
            ).single()
            return result["count"]
    
    # --- 인덱스 워밍업 (앱 시작 시 1회 호출)-
    def warmup_indexes(self) -> None:
        """
        모든 벡터 인덱스에 더미 쿼리를 날려 RAM에 올림
        startup 이벤트나 lifespan 훅에서 호출
        """
        with self._warmup_lock:
            if self._warmup_done:
                return
            
            index_names = (
                [f"patent_{s.lower()}_only_index" for s in SECTIONS]
                + ["patent_vector_index"]
            )
            
            with self.driver.session() as session:
                for idx in index_names:
                    try:
                        session.run(
                            f"""
                            CALL db.index.vector.queryNodes('{idx}', $topk, $vec)
                            YIELD node RETURN node LIMIT 1
                            """,
                            topk = WARMUP_TOPK,
                            vec = WARMUP_VECTOR,
                        ).consume()
                        logger.info(f"✅ Warmup OK : {idx}")
                    except Exception as e:
                        logger.warning(f"⚠️  Warmup FAIL: {idx} — {e}")
        
            self._warmup_done = True
            logger.info("🔥 All vector indexes warmed up.")
        
    
    # --- 캐시 ------------------------------------------
    def _get_vector(self, section_label: str, keyword: str) -> List[float]:
        key = f"{section_label.lower()}:{keyword}:vector"
        if key not in self._search_cache:
            raw = get_embedding(keyword)
            self._search_cache[key] = raw.tolist() if hasattr(raw, "tolist") else raw
        return self._search_cache[key]
    
    
    def clear_all_cache(self) -> Dict:
        count = len(self._search_cache)
        self._search_cache.clear()
        return {"message": f"Successfully cleared {count} cache items."}
    

# --------------------------------------------------------------
# PatentService (키워드 검색 + 네비게이션 + 출원인 유사 검색)
# --------------------------------------------------------------
class PatentService:
    """
    - search_patents            : 키워드 벡터 검색
    - navigate_patents          : 유사 특허 네비게이션
    - navigate_applicants       : 유사 출원인 검색
    """
    
    def __init__(self, search_service: Neo4jSearchService):
        self.driver = search_service.driver
        self._search = search_service
        
    
    # --- 청구항 조회 -------------------------------------------
    def get_claims(self, app_numbers: list[str]) -> list[dict]:
        cypher = """
        UNWIND $app_numbers AS app_num
        MATCH (p:Patent {app_num: app_num})-[:HAS_CLAIM]->(c:Claim)
        WITH p.app_num AS application_number, c
        ORDER BY c.claim_num
        RETURN
            application_number,
            collect({
                claim_num:      c.claim_num,
                claim_id:       c.claim_id,
                text:           c.text,
                is_independent: c.is_independent
            }) AS claims
        ORDER BY application_number
        """
        with self.driver.session() as session:
            result = session.run(cypher, app_numbers=app_numbers)
            return [dict(r) for r in result]

    # --- 키워드 벡터 검색 --------------------------------------
    def search_patents(
        self,
        section: Optional[str],
        keyword: str,
        page: int = 1,
        size: int = 10,
    ) -> Tuple[int, List[Dict]]:
        
        section_label = section.upper() if section and section != "all" else "ALL"
        query_vector = self._search._get_vector(section_label, keyword)
        skip_count = (page -1) * size
        
        if section_label in SECTIONS:
            index_name = f"patent_{section_label.lower()}_only_index"
            target_label = f"Patent_{section_label}"
        else:
            index_name = "patent_vector_index"
            target_label = "Patent"
            
        cypher = f"""
        CALL db.index.vector.queryNodes('{index_name}', 1000, $vector)
        YIELD node AS p, score
        WHERE $label IN labels(p)
        OPTIONAL MATCH (p)-[r:CLASSIFIED_AS_CPC]->(cpc:CPC_Subgroup)
        WITH p, score, collect({{code: cpc.code, is_main: r.is_main}}) AS cpc_info
        
        RETURN 
            p.app_num   AS application_number,
            p.title     AS title,
            p.abstract  AS abstract,
            p.app_date  AS filing_date,
            p.reg_num   AS reg_num,
            p.status AS end_status,
            cpc_info    AS cpc_code,
            score
        ORDER BY score DESC
        SKIP $skip LIMIT $limit
        """
        
        with self.driver.session() as session:
            try:
                result = session.run(
                    cypher,
                    vector=query_vector,
                    label=target_label,
                    skip=skip_count,
                    limit=size,
                )
                records = [dict(r) for r in result]
                for rec in records:
                    rec['filing_date'] = _parse_filing_date(rec.get('filing_date'))
                    rec['cpc_code']    = _parse_cpc_code(rec.get('cpc_code') or [])
                return 1000, records
            except Exception as e:
                logger.error(f"❌ Neo4j Query Error: {e}")
                raise
    
    # --- 유사 특허 번호 리스트 반환 --------------------------------------------
    def find_similar_patents(
        self,
        app_number: str,
        section: str,
        top_n: int = 60,
    ) -> List[str]:
        section_upper = section.upper()
        index_name = (
            f"patent_{section_upper.lower()}_only_index"
            if section_upper in SECTIONS
            else "patent_vector_index"
        )
        
        cypher = f"""
        MATCH (p:Patent {{app_num: $app}})
        CALL db.index.vector.queryNodes('{index_name}', $top_n, p.embedding)
        YIELD node AS patent, score
        RETURN patent.app_num AS app_number
        """
        
        try:
            with self.driver.session() as session:
                result = session.run(cypher, app=app_number, top_n=top_n+1)
                return [r["app_number"] for r in result]
        except Exception as e:
            logger.error(f"❌ find_similar_patents Error: {e}")
            raise
    
    # --- 유사 특허 네비게이션 ---------------------------------------------------
    def navigate_patents(self, app_number: str, section: str="ALL") -> List[Dict]:
        section_upper = section.upper()
        index_name = (
            f"patent_{section_upper.lower()}_only_index"
            if section_upper in SECTIONS
            else "patent_vector_index"
        )
        
        cypher = f"""
        MATCH (p:Patent {{app_num: $app}})
        CALL db.index.vector.queryNodes('{index_name}', 10, p.embedding)
        YIELD node AS patent, score
        OPTIONAL MATCH (patent)-[:CLASSIFIED_AS_CPC]->(c:CPC_Subgroup)
        WITH patent, score, collect(c.code) AS cpc_codes
        RETURN
            patent.app_num               AS application_number,
            toString(patent.app_date)    AS filing_date,
            score,
            reduce(s = "", x IN cpc_codes |
            s + (CASE WHEN s = "" THEN "" ELSE "|" END) + x
            ) AS cpc_code
        LIMIT 10
        """
        
        try:
            with self.driver.session() as session:
                records = [dict(r) for r in session.run(cypher, app=app_number)]
                if not records:
                    return []
                
                df = pd.DataFrame(records)
                df["filing_date"] = pd.to_datetime(df["filing_date"], errors="coerce").fillna(pd.Timestamp.now())
                df["distance"] = 1.0 - df["score"]
                
                center_date = df.iloc[0]["filing_date"]
                df["date_difference"] = (df["filing_date"] - center_date).dt.days
                df["date_type"] = df["date_difference"].apply(
                    lambda x : 1 if x > 0 else (-1 if x < 0 else 0)
                )
                
                scaler = MinMaxScaler()
                if len(df) > 1:
                    df.loc[1:, "scaler_date"] = (
                        scaler.fit_transform(df.loc[1:, ["date_difference"]]) + 0.1
                    )
                    df["x_value"] = scaler.fit_transform(df[["distance"]])
                else:
                    df["scaler_date"] = 0.0
                    df["x_value"] = 0.0
                    
                df["y_value"] = df["date_type"] * df["scaler_date"]
                df["score_log"] = np.log1p(df['score'])
                
                # 기준 특허(본인) 강제 보정
                df.loc[0, ["scaler_date", "y_value", "x_value", "score_log"]] =[
                    -9_999_999.0, 0.0, 0.0, 0.0
                ]
                
                df = df.where(pd.notna(df), None)
                df["filing_date"] = df["filing_date"].dt.strftime("%Y-%m-%d T%H:%M:%S")
                return df.to_dict(orient="records")
            
        except Exception as e:
            logger.error(f"❌ Navigation Service Error: {e}")
            return []
        
        
    # --- 유사 출원인 검색 -----------------------------------------------------
    def navigate_applicants(
        self,
        app_number: str,
        index: str,
        maxsize: int = 100,
        top_n: int = 10,
    ) -> pd.DataFrame:
        
        index_name = f"patent_{index.lower()}_only_index"
        
        cypher = f"""
        MATCH (p:Patent {{app_num: $app}})
        CALL db.index.vector.queryNodes('{index_name}', $maxsize, p.embedding)
        YIELD node AS patent, score
        
        OPTIONAL MATCH (patent)-[:APPLIED]-(a:Applicant)
        WITH a, replace(a.name, ' ', '') AS company, score, patent
        WHERE a.app_id IS NOT NULL
        AND size(company) >= 4
        AND company =~ '.*(회사|법인|연구원|대학교|공단|공사|청).*'
        
        WITH
        a.app_id                  AS applicant_code,
        a.name                    AS applicant_name_rep,
        min(1 - score)            AS min_distance,
        max(patent.app_date.year) AS max_filing_year,
        count(*)                  AS application_count
        
        RETURN applicant_code, applicant_name_rep,
               min_distance, max_filing_year, application_count
               
        UNION
        
        MATCH (p:Patent {{app_num: $app}})-[:APPLIED]-(a:Applicant)
        RETURN
        a.app_id        AS applicant_code,
        a.name          AS applicant_name_rep,
        0.0             AS min_distance,
        p.app_date.year AS max_filing_year,
        1               AS application_count
        
        ORDER BY application_count DESC
        LIMIT $top_n
        """
        
        with self.driver.session() as session:
            records = [
                r.data()
                for r in session.run(cypher, app=app_number, maxsize=maxsize, top_n=top_n)
            ]
            
        df = pd.DataFrame(records)
        if not df.empty:
            df["min_distance"]         = df["min_distance"].astype(float)
            df["application_count"]    = df["application_count"].astype(int)
            df.sort_values("min_distance", ascending=True, inplace=True)
            
        return df.head(10)
    
    
# -------------------------------------------
neo4j_service = Neo4jSearchService(
    uri         = os.getenv("NEO4J_URI", "bolt://192.168.1.116:7687"),
    user        = os.getenv("NEO4J_USER", "neo4j"),
    password    = os.getenv("NEO4J_PASSWORD", "doslvkdlqm!")
)

patent_service = PatentService(neo4j_service)         