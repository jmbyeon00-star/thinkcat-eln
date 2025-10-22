import os
import pymysql
from dotenv import load_dotenv

load_dotenv()
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_USER = os.getenv("DB_USER", "")
DB_PASS = os.getenv("DB_PASS", "")
DB_TYPE = os.getenv("DB_TYPE", "ipforce")
DB_CHAR = os.getenv("DB_CHAR", "utf8mb4")
DB_DATA = os.getenv("DB_DATA", "dict")

def db_connect(host=DB_HOST, user=DB_USER, password=DB_PASS, db=DB_TYPE, charset=DB_CHAR, data_type=DB_DATA):
    if data_type == "dict":
        connection = pymysql.connect(
            host=host,
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