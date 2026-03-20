# -------------------------------
# navigation (milvusgraph_API.py)
# → Milvus 대신 GPU Backend HTTP 호출
# -------------------------------
import os
import pandas as pd
import numpy as np
import requests
from sklearn.preprocessing import MinMaxScaler
from sqlalchemy.orm import Session
from app.models.patent_model import PatentResult

GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://gpu_backend_dev:8008")


# -------------------------
# 🔹 벡터 조회 (GPU Backend 프록시)
# -------------------------
def find_vector(app_number: str, index_code: str):
    """GPU Backend를 통해 특정 출원번호의 벡터를 조회합니다."""
    try:
        response = requests.get(
            f"{GPU_BACKEND_URL}/gpu/patent/milvus/vector",
            params={"appNumber": app_number, "collection": index_code},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("vector", [])
        return []
    except Exception as e:
        print(f"Error in find_vector (GPU proxy): {e}")
        return []


# -------------------------
# 🔹 L2 distance 유사도 검색 (GPU Backend 프록시)
# -------------------------
def find_relevant(app_number: str, index_code: str, maxsize: int = 10):
    """GPU Backend를 통해 L2 distance 기반 유사도 검색을 수행합니다."""
    try:
        response = requests.post(
            f"{GPU_BACKEND_URL}/gpu/patent/milvus/search",
            json={
                "app_number": app_number,
                "collection": index_code,
                "maxsize": maxsize
            },
            timeout=30
        )
        response.raise_for_status()
        data = response.json()
        if data.get("success"):
            return data.get("data", [])
        return []
    except Exception as e:
        print(f"Error in find_relevant (GPU proxy): {e}")
        return []


# -------------------------
# 🔹 날짜 기반 스케일링
# -------------------------
def process_data_with_scaling(merged_data: list[dict]):
    df = pd.DataFrame(merged_data)
    df["filing_date"] = pd.to_datetime(df["filing_date"], format="%Y%m%d", errors="coerce")

    # 기준 날짜 설정
    center_rows = df[df["score"] == 0]
    center_date = center_rows["filing_date"].mean() if not center_rows.empty else df["filing_date"].mean()

    df["date_difference"] = df["filing_date"].apply(lambda x: (x - center_date).days if pd.notna(x) else 0)
    df["date_type"] = df["date_difference"].apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))

    scaler = MinMaxScaler()

    if len(df) > 1:
        scaler_date_df = df.loc[1:, "date_difference"].values.reshape(-1, 1)
        df.loc[1:, "scaler_date"] = scaler.fit_transform(scaler_date_df) + 0.1
    else:
        df["scaler_date"] = 0.1

    df["y_value"] = df["date_type"] * df["scaler_date"]
    # ✅ 로그 스케일 변환 추가 (거리값이 너무 클 때 왼쪽으로 당김)
    df["score_log"] = np.log1p(df["score"].abs())  # log(1 + score)
    df["x_value"] = scaler.fit_transform(df[["score_log"]]) ** 0.8

    df.loc[df["score"] == 0, ["x_value", "y_value"]] = 0

    # ✅ Timestamp → ISO 문자열 변환
    df["filing_date"] = df["filing_date"].apply(
        lambda x: x.isoformat() if not pd.isna(x) else None
    )

    df.fillna(-9999999, inplace=True)
    return df



# -------------------------
# 🔹 네비게이션 검색 서비스
# -------------------------
def search_app_service(db: Session, application_number: str, index_code: str):
    """특허 네비게이션 핵심 서비스 로직"""
    # 1. GPU Backend를 통해 유사 특허 검색
    results = find_relevant(app_number=application_number, index_code=index_code)
    if not results:
        return None, "No similar patents found"

    # 2. DB 조회
    score_app_list = [r["application_number"] for r in results]
    rows = (
        db.query(PatentResult)
        .filter(PatentResult.application_number.in_(score_app_list))
        .all()
    )
    
    if not rows:
        return None, "No patent data found in database"

    # 3. 데이터 매핑
    mapped_data = []
    for r in results:
        for row in rows:
            if str(r["application_number"]) == str(row.application_number):
                mapped_data.append({
                    "application_number": r["application_number"],
                    "score": r["score"],
                    "filing_date": row.filing_date,
                    "ipc_code": row.ipc_code
                })
                break

    if not mapped_data:
        return None, "Failed to merge search results with patent data"

    # 4. 스케일링 처리
    df = process_data_with_scaling(mapped_data)
    df.fillna(-9999999, inplace=True)
    return df.to_dict(orient="records"), None
