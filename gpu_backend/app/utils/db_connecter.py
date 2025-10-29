import os
import pymysql
from dotenv import load_dotenv

load_dotenv()
DB_HOST = os.getenv("DB_HOST", "175.118.126.24")
DB_PORT = os.getenv("DB_PORT", "3307")
DB_USER = os.getenv("DB_USER", "root")
DB_PASS = os.getenv("DB_PASS", "doslvkdlqm!")
DB_TYPE = os.getenv("DB_TYPE", "ipforce")
DB_CHAR = os.getenv("DB_CHAR", "utf8mb4")
DB_DATA = os.getenv("DB_DATA", "dict")

def db_connect(host=DB_HOST, port=DB_PORT, user=DB_USER, password=DB_PASS, db=DB_TYPE, charset=DB_CHAR, data_type=DB_DATA):
    if data_type == "dict":
        connection = pymysql.connect(
            host=host,
            port=int(port),
            user=user,
            password=password,
            db=db,
            charset=charset,
            cursorclass=pymysql.cursors.DictCursor
        )
    else:
        connection = pymysql.connect(
            host=const.host,
            user=user,
            password=password,
            db=db,
            charset=charset
        )
    cursor = connection.cursor()
    
    return connection, cursor