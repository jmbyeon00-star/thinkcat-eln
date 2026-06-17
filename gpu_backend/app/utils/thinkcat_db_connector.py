import pymysql
import os


THINKCAT_DB_HOST = os.getenv("THINKCAT_DB_HOST", "192.168.1.20")
THINKCAT_DB_PORT = int(os.getenv("THINKCAT_DB_PORT", "3306"))
THINKCAT_DB_USER = os.getenv("THINKCAT_DB_USER", "root")
THINKCAT_DB_PASSWORD = os.getenv("THINKCAT_DB_PASSWORD", "")
THINKCAT_DB_NAME = os.getenv("THINKCAT_DB_NAME", "thinkcateln")


def get_db_connection():
    return pymysql.connect(
        host=THINKCAT_DB_HOST,
        port=THINKCAT_DB_PORT,
        user=THINKCAT_DB_USER,
        password=THINKCAT_DB_PASSWORD,
        database=THINKCAT_DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )


def update_task_status(task_id: int, status: str, note_id: int = None, error_msg: str = None):
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            sql = """
                UPDATE pdf_processing_tasks
                SET status = %s, note_id = %s, error_message = %s
                WHERE task_id = %s
            """
            val_note_id = int(note_id) if note_id is not None else None
            cur.execute(sql, (status, val_note_id, error_msg, task_id))
            conn.commit()
    except Exception as e:
        raise e
    finally:
        conn.close()


def save_parsed_content(content: str) -> int:
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            clean_content = content[0] if isinstance(content, (list, tuple)) else str(content)
            sql = "INSERT INTO research_note_contents (content) VALUES (%s)"
            cur.execute(sql, (clean_content,))
            conn.commit()
            cur.execute("SELECT LAST_INSERT_ID()")
            result = cur.fetchone()
            note_id = list(result.values())[0] if isinstance(result, dict) else result[0]
            return int(note_id)
    except Exception as e:
        raise e
    finally:
        conn.close()
