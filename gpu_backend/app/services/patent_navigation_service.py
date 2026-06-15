# -------------------------------
# navigation (milvusgraph_API.py)
# -------------------------------
import os
import pandas as pd
import numpy as np
from pymilvus import connections, Collection
from sklearn.preprocessing import MinMaxScaler
from sqlalchemy.orm import Session
from app.models.patent_model import PatentResult

MILVUS_HOST = os.getenv("MILVUS_HOST", "localhost")
MILVUS_PORT = os.getenv("MILVUS_PORT", "19530")

# Milvus 연결 (v2.5.4)
try:
    connections.connect(alias="default", host=MILVUS_HOST, port=MILVUS_PORT, timeout=5.0)
    print(f"Successfully connected to Milvus at {MILVUS_HOST}:{MILVUS_PORT}")
except Exception as e:
    print(f"Failed to connect to Milvus at {MILVUS_HOST}:{MILVUS_PORT}: {e}")


# -------------------------
# 🔹 벡터 조회
# -------------------------
def find_vector(app_number: str, index: str):
    """특정 출원번호의 벡터를 조회합니다."""
    try:
        collection = Collection(name=index)
        collection.load()
        filter_expression = f"address == {app_number}"
        results = collection.query(expr=filter_expression, output_fields=["address", "vector"])
        if not results:
            print(f"No vector found for {app_number}")
            return []
        return results[0]["vector"]
    except Exception as e:
        print(f"Error in find_vector: {e}")
        return []


# -------------------------
# 🔹 L2 distance 유사도 검색
# -------------------------
def find_relevant(app_number: str, index: str, maxsize: int = 10):
    """L2 distance 기반 유사도 검색을 수행합니다."""
    query_vector = find_vector(app_number, index)
    if not query_vector:
        return []

    try:
        collection = Collection(name=index)
        collection.load()

        search_params = {
            "metric_type": "L2",
            "params": {"nprobe": 10}
        }

        result = collection.search(
            data=[query_vector],
            anns_field="vector",
            param=search_params,
            limit=maxsize,
            output_fields=["address"]
        )

        final_result = []
        for hits in result:
            for hit in hits:
                final_result.append({
                    "application_number": hit.entity.get("address"),
                    "score": hit.distance
                })
        return final_result
    except Exception as e:
        print(f"Error in find_relevant: {e}")
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
    df["x_value"] = scaler.fit_transform(df[["score"]].abs())

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
    index = f"{index_code.lower()}_collection"

    # 1. 유사 특허 검색
    results = find_relevant(app_number=application_number, index=index)
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
