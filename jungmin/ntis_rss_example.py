"""
NTIS RSS 수집 예제
흐름: RSS XML 가져오기 → 필드 파싱 → 날짜 필터(어제+오늘) → URL 중복 제거

RSS URL: https://www.ntis.go.kr/rndgate/eg/unRndRss.xml?prt=N
  prt     : 가져올 건수. 최대 100건 하드캡, 페이지네이션 없음
            → 100건으로 최근 ~50일치 커버 (하루 평균 2건 수준)
  author  : 부처명  (보건복지부 등)   ← DB에 넣으려면 컬럼 추가 필요
  category: 공고기관명 (한국보건산업진흥원 등) → organization 매핑
"""

import requests
import xml.etree.ElementTree as ET
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

NTIS_RSS_URL = "https://www.ntis.go.kr/rndgate/eg/unRndRss.xml"

# RSS 태그 → DB 컬럼명 매핑
RSS_COLUMN_MAP = {
    'category':  'organization',       # 공고기관명
    'title':     'title',              # 공고명
    'link':      'URL',                # 공고문 URL
    'pubDate':   'announcement_date',  # 공고일
    'appbegin':  'start_date',         # 접수일
    'appdue':    'end_date',           # 마감일
    'budget':    'budget',             # 공고금액
    # 'author' = 부처명 → 필요하면 RSS_COLUMN_MAP에 추가 후 DB 컬럼도 추가
    # 'status' 필드는 RSS에 없음 → crawler_utils.calculate_status()로 계산
}


def _parse_pubdate(raw: str) -> str:
    """'2026.06.10' → '2026-06-10'  (appbegin/appdue는 이미 YYYY-MM-DD)"""
    return raw.strip().replace('.', '-') if raw else ''


def _find_text(item: ET.Element, tag: str) -> str | None:
    """namespace가 있어도 tag 로컬명으로 검색"""
    el = item.find(tag)
    if el is not None:
        return (el.text or '').strip() or None
    for child in item:
        local = child.tag.split('}')[-1] if '}' in child.tag else child.tag
        if local == tag:
            return (child.text or '').strip() or None
    return None


def fetch_ntis_rss(prt: int = 100) -> list[dict]:
    """
    NTIS RSS XML 파싱 → raw dict 리스트 반환
    prt: 최대 100건 하드캡 (서버 제한, 페이지네이션 없음)
    """
    resp = requests.get(NTIS_RSS_URL, params={'prt': prt}, timeout=15)
    resp.encoding = 'utf-8'
    root = ET.fromstring(resp.content)

    items = []
    for item in root.findall('.//item'):
        row = {}
        for rss_tag, db_col in RSS_COLUMN_MAP.items():
            row[db_col] = _find_text(item, rss_tag)

        # pubDate만 점(.) → 대시(-) 정규화 (appbegin/appdue는 이미 YYYY-MM-DD)
        if row.get('announcement_date'):
            row['announcement_date'] = _parse_pubdate(row['announcement_date'])

        items.append(row)

    return items


def collect_recent(days_back: int = 1, prt: int = 100) -> pd.DataFrame:
    """
    오늘 + 어제(days_back=1) 공고 수집
      1. RSS 파싱
      2. announcement_date >= cutoff 필터
      3. URL 중복 제거
    """
    cutoff = (datetime.now() - timedelta(days=days_back)).strftime('%Y-%m-%d')

    all_items = fetch_ntis_rss(prt=prt)
    filtered = [
        row for row in all_items
        if (row.get('announcement_date') or '') >= cutoff
    ]

    if not filtered:
        logger.info(f"NTIS: {cutoff} 이후 신규 공고 없음")
        return pd.DataFrame()

    df = pd.DataFrame(filtered)

    before = len(df)
    df = df.drop_duplicates(subset=['URL'], keep='first')
    after = len(df)
    if before != after:
        logger.info(f"NTIS URL 중복 제거: {before - after}건")

    logger.info(f"NTIS 수집 완료: {len(df)}건 (기준일: {cutoff})")
    return df


if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')

    df = collect_recent(days_back=1)

    if df.empty:
        print("수집 결과 없음")
    else:
        print(f"\n총 {len(df)}건\n")
        cols = ['organization', 'title', 'announcement_date', 'start_date', 'end_date', 'budget']
        pd.set_option('display.max_colwidth', 50)
        print(df[cols].to_string(index=False))
