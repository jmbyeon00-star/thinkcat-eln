import pandas as pd
import pymysql
from pickle import load
from contextlib import contextmanager
from sqlalchemy.orm import Session
import warnings
warnings.filterwarnings("ignore")


# -------------------------
# 🔹 DB 연결 컨텍스트
# -------------------------
@contextmanager
def get_db_connection():
    """직접 pymysql로 연결"""
    conn_info = {
        "user": "root",
        "password": "doslvkdlqm!",
        "host": "175.118.126.24",
        "database": "ipforce",
    }
    connection = pymysql.connect(**conn_info)
    try:
        yield connection
    finally:
        connection.close()


# -------------------------
# 🔹 출원번호로 등록번호 + 권리자 정보 조회
# -------------------------
def get_db(appNumber: str):
    try:
        with get_db_connection() as connection:
            cursor = connection.cursor(pymysql.cursors.DictCursor)

            sql = f"""
            SELECT reg_number FROM PATENT_RESULT_TB 
            WHERE application_number = '{appNumber}'
            """
            cursor.execute(sql)
            result = cursor.fetchall()
            regNumber = result[0]["reg_number"] if result and result[0]["reg_number"] else None

            if not regNumber:
                return pd.DataFrame()

            sql = f"""
            SELECT RGSTNO, RGT_TRNSF_SEQ, RGTR_SEQ, RGTR_CD, RGTR_NM, RGTR_ADDR
            FROM PATENT_INFO_TB
            WHERE RGSTNO = '{regNumber}';
            """
            cursor.execute(sql)
            data = cursor.fetchall()
            cursor.close()

    except pymysql.MySQLError as e:
        print(f"Database error in get_db: {e}")
        return pd.DataFrame()

    return pd.DataFrame(data)


# -------------------------
# 🔹 출원인 코드 리스트로 LITI 데이터 조회
# -------------------------
def get_liti_tb(findList: list[int]):
    if not findList:
        return pd.DataFrame()

    try:
        with get_db_connection() as connection:
            cursor = connection.cursor(pymysql.cursors.DictCursor)
            placeholders = ",".join(["%s"] * len(findList))
            sql = f"""
            SELECT 
                applicant_code,
                name,
                transfer_cnt,
                apply_cnt,
                defendant,
                plaintiff
            FROM PATENT_LITI_TB
            WHERE applicant_code IN ({placeholders})
            """
            cursor.execute(sql, tuple(findList))
            data = cursor.fetchall()
            cursor.close()
    except pymysql.MySQLError as e:
        print(f"Database error in get_liti_tb: {e}")
        return pd.DataFrame()

    return pd.DataFrame(data)


# -------------------------
# 🔹 모델 및 스케일러 로드
# -------------------------
def get_model():
    model_path = "/app/app/services/model/npe_predict_model"
    scaler_path = "/app/app/services/stdSc/standard_scaler.pkl"
    model = load(open(model_path, "rb"))
    scaler = load(open(scaler_path, "rb"))
    return model, scaler


# -------------------------
# 🔹 NPE 확률 계산 메인 서비스
# -------------------------
def get_appNumber_service(appNumber: str):
    """출원번호 기반 NPE 확률 계산"""
    search_df = get_db(appNumber)
    model, scaler = get_model()

    if search_df.empty:
        return [], 400

    # 최신 권리자 코드 리스트 추출
    con = search_df["RGT_TRNSF_SEQ"] == search_df["RGT_TRNSF_SEQ"].max()
    find_list = list(filter(None, search_df.loc[con, "RGTR_CD"].values))

    if not find_list:
        search_df["npe_prob"] = 0
        total = search_df
    else:
        find_list = list(map(int, find_list))
        X_data = get_liti_tb(find_list)

        if X_data.empty:
            search_df["npe_prob"] = 0
            total = search_df
        else:
            # 🔹 모델 예측
            X_data = X_data.rename(columns={"transfer_cnt": "권리자변동이력", "apply_cnt": "출원수"})
            feature = scaler.transform(X_data[["권리자변동이력", "출원수", "defendant", "plaintiff"]])
            predict_prob = model.predict_proba(feature)[:, 1]

            # 🔹 예측 결과 병합
            X_data["npe_prob"] = predict_prob
            X_data.rename(columns={"applicant_code": "RGTR_CD"}, inplace=True)
            X_data["RGTR_CD"] = X_data["RGTR_CD"].astype(str)

            total = pd.merge(search_df, X_data[["RGTR_CD", "npe_prob"]], on="RGTR_CD", how="left")
            total["npe_prob"].fillna(0, inplace=True)

    total = total.where(pd.notna(total), None)
    return total.to_dict(orient="records"), 200
