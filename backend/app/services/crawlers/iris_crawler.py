import requests
import pandas as pd
import time
import logging
from app.services.crawlers.crawler_utils import format_date, calculate_status, remove_duplicates, get_today

logger = logging.getLogger(__name__)


class IRISCrawler:

    def __init__(self):
        self.base_url = "https://www.iris.go.kr"
        self.api_url = f"{self.base_url}/contents/retrieveBsnsAncmBtinSituList.do"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest'
        }

    def _crawl_type(self, prg_type, max_pages=6):
        today = get_today()
        all_data = []

        for page in range(1, max_pages + 1):
            params = {'pageIndex': str(page), 'ancmPrg': prg_type}
            try:
                resp = requests.post(self.api_url, data=params, headers=self.headers, timeout=15)
                items = resp.json().get('listBsnsAncmBtinSitu', [])
            except Exception as e:
                logger.error(f"IRIS 크롤링 오류 (타입: {prg_type}, 페이지: {page}): {e}")
                break

            if not items:
                break

            stop_crawling = False
            for item in items:
                ancm_date = format_date(item.get('ancmDe'))

                if ancm_date and ancm_date < today:
                    stop_crawling = True
                    break
                if ancm_date != today:
                    continue

                status_raw = item.get('rcveSttSeNmLst', [])
                status_str = "".join(status_raw) if isinstance(status_raw, list) else str(status_raw)
                if '미게시' in status_str:
                    continue

                start_dt = format_date(item.get('rcveStrDe'))
                end_dt = format_date(item.get('rcveEndDe'))

                all_data.append({
                    'organization': (item.get('sorgnNm') or '').strip(),
                    'title': (item.get('ancmTl') or '').strip(),
                    'URL': f"{self.base_url}/contents/retrieveBsnsAncmView.do?ancmId={item.get('ancmId')}",
                    'announcement_date': ancm_date,
                    'start_date': start_dt,
                    'end_date': end_dt,
                    'status': calculate_status(start_dt, end_dt),
                    'budget': None
                })

            if stop_crawling:
                break
            time.sleep(0.2)

        return all_data

    def crawl_today(self, max_pages=6) -> pd.DataFrame:
        try:
            logger.info("IRIS 크롤링 시작")
            pre_data = self._crawl_type('ancmPre', max_pages)
            logger.info(f"IRIS 접수예정: {len(pre_data)}건")
            ing_data = self._crawl_type('ancmIng', max_pages)
            logger.info(f"IRIS 접수중: {len(ing_data)}건")

            all_data = pre_data + ing_data
            if not all_data:
                logger.info("IRIS 오늘 날짜 공고 없음")
                return pd.DataFrame()

            df = pd.DataFrame(all_data)
            df = remove_duplicates(df, 'IRIS')
            logger.info(f"IRIS 최종: {len(df)}건")
            return df
        except Exception as e:
            logger.error(f"IRIS 크롤링 실패: {e}")
            return pd.DataFrame()
