import requests
from bs4 import BeautifulSoup
import pandas as pd
import time
import logging
from app.services.crawlers.crawler_utils import calculate_status, remove_duplicates

logger = logging.getLogger(__name__)


class SBACrawler:

    def __init__(self):
        self.base_url = "https://seoul.rnbd.kr"
        self.list_url = f"{self.base_url}/client/c030100/c030100_00.jsp"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

    def _parse_date_range(self, text: str):
        """'2026-06-05 ~ 2026-07-09' → (start, end)"""
        try:
            parts = text.strip().split('~')
            if len(parts) == 2:
                return parts[0].strip(), parts[1].strip()
        except Exception:
            pass
        return None, None

    def _crawl_page(self, page_num: int):
        url = f"{self.list_url}?sField=&sWord=&sFlag=&cPage={page_num}"
        page_data = []

        try:
            resp = requests.get(url, headers=self.headers, timeout=10)
            resp.encoding = 'utf-8'
            soup = BeautifulSoup(resp.text, 'html.parser')

            tbody = soup.find('tbody')
            if not tbody:
                return [], False

            rows = tbody.find_all('tr')
            for row in rows:
                cells = row.find_all('td')
                if len(cells) < 4:
                    continue

                # 상태 확인 (모집중 + 모집예정만 수집)
                status_span = cells[3].find('span', class_='recruit')
                if not status_span:
                    continue

                classes = status_span.get('class', [])
                is_active = 'ing' in classes or 'pre' in classes
                if not is_active:
                    continue

                # 제목 & URL
                link = cells[1].find('a')
                if not link:
                    continue
                title = link.text.strip()
                href = link.get('href', '')
                full_url = f"{self.base_url}/client/c030100/{href}" if href else ''

                # 모집기간
                date_text = cells[2].text.strip()
                start_date, end_date = self._parse_date_range(date_text)

                page_data.append({
                    'organization': '서울진흥원',
                    'title': title,
                    'URL': full_url,
                    'announcement_date': start_date,
                    'start_date': start_date,
                    'end_date': end_date,
                    'status': calculate_status(start_date, end_date),
                    'budget': None
                })

            return page_data

        except Exception as e:
            logger.error(f"SBA 페이지 {page_num} 오류: {e}")
            return []

    def crawl_recruiting(self, max_pages=5) -> pd.DataFrame:
        try:
            logger.info("SBA 크롤링 시작")
            all_data = []

            for page_num in range(1, max_pages + 1):
                page_data = self._crawl_page(page_num)
                if page_data:
                    all_data.extend(page_data)
                    logger.info(f"SBA 페이지 {page_num}: {len(page_data)}건")

                if page_num < max_pages:
                    time.sleep(0.3)

            if not all_data:
                logger.info("SBA 모집중 공고 없음")
                return pd.DataFrame()

            df = pd.DataFrame(all_data)
            df = remove_duplicates(df, 'SBA')
            logger.info(f"SBA 최종: {len(df)}건")
            return df

        except Exception as e:
            logger.error(f"SBA 크롤링 실패: {e}")
            return pd.DataFrame()
