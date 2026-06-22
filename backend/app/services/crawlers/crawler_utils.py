import pandas as pd
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def format_date(date_str: str) -> str:
    if not date_str:
        return ""
    return date_str.replace('.', '-').strip()


def calculate_status(start_date: str, end_date: str) -> str:
    if not start_date or not end_date:
        return "정보없음"
    today = datetime.now().strftime('%Y-%m-%d')
    if today < start_date:
        return "접수예정"
    elif start_date <= today <= end_date:
        return "접수중"
    else:
        return "마감"


def remove_duplicates(df: pd.DataFrame, site_name: str) -> pd.DataFrame:
    if df.empty:
        return df
    before = len(df)
    df = df.drop_duplicates(subset=['URL'], keep='first')
    after = len(df)
    if before != after:
        logger.info(f"{site_name} 중복 제거: {before - after}건")
    return df


def get_today() -> str:
    return datetime.now().strftime('%Y-%m-%d')
