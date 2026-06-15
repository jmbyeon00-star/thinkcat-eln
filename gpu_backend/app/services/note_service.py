import os
import re
import shutil
import tempfile
import fitz
import logging

from app.utils.thinkcat_db_connector import get_db_connection, update_task_status, save_parsed_content

logger = logging.getLogger("uvicorn.error")

ELN_FILE_BASE_PATH = os.getenv("ELN_FILE_BASE_PATH", "/home/thinkcat/docker/elnfiles")


def get_processing_strategy(pdf_path):
    doc = fitz.open(pdf_path)
    text_content = ""
    strategy = None

    for page in doc.pages(start=0, stop=3):
        text_content += page.get_text().strip() + "\n"
        if len(page.find_tables().tables) > 0:
            strategy = "OCR_PROCESSING"
            break

    doc.close()

    if strategy:
        return strategy
    return "NATIVE_EXTRACTION" if len(text_content.strip()) > 50 else "OCR_PROCESSING"


def clean_markdown_to_plain_text(md_text):
    text = re.sub(r'#+\s?', '', md_text)
    text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
    text = re.sub(r'\*(.*?)\*', r'\1', text)
    text = re.sub(r'!?\[(.*?)\]\(.*?\)', r'\1', text)
    text = re.sub(r'^\s*[-*+]\s+', '', text, flags=re.MULTILINE)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def _extract_content(pdf_path: str, task_id, marker_models) -> str:
    strategy = get_processing_strategy(pdf_path)
    print(f"Task {task_id} - Selected processing strategy: {strategy}", flush=True)

    if strategy == "NATIVE_EXTRACTION":
        print(f"Task {task_id} - Using Fast Native Extraction", flush=True)
        doc = fitz.open(pdf_path)
        content = " ".join([page.get_text() for page in doc])
        doc.close()
        return content
    else:
        print(f"Task {task_id} - Using Marker OCR Engine", flush=True)
        from marker.convert import convert_single_pdf
        if not pdf_path.endswith(".pdf"):
            tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
            tmp.close()
            shutil.copy2(pdf_path, tmp.name)
            try:
                full_text, _images, _meta = convert_single_pdf(tmp.name, marker_models, batch_multiplier=2)
            finally:
                os.unlink(tmp.name)
        else:
            full_text, _images, _meta = convert_single_pdf(pdf_path, marker_models, batch_multiplier=2)
        return clean_markdown_to_plain_text(full_text)


def run_parsing(task_id: str, file_path: str, marker_models):
    pdf_path = os.path.join(ELN_FILE_BASE_PATH, file_path)
    conn = get_db_connection()
    try:
        if not os.path.exists(pdf_path):
            print(f"Task {task_id} - File not found: {pdf_path}")
            update_task_status(task_id, 'failed', error_msg=f"File not found: {pdf_path}")
            return

        update_task_status(task_id, 'processing')
        actual_content = _extract_content(pdf_path, task_id, marker_models)
        note_id = save_parsed_content(actual_content)
        update_task_status(task_id, 'completed', note_id=note_id)

    except Exception as e:
        print(f"Error processing task {task_id}: {e}")
        update_task_status(task_id, 'failed', error_msg=str(e))
    finally:
        conn.close()


def run_parsing_sync(task_id: str, file_path: str, marker_models) -> dict:
    pdf_path = os.path.join(ELN_FILE_BASE_PATH, file_path)
    conn = get_db_connection()
    try:
        if not os.path.exists(pdf_path):
            update_task_status(task_id, 'failed', error_msg=f"File not found: {pdf_path}")
            return {"task_id": task_id, "success": 0, "contents": "", "message": f"File not found: {pdf_path}"}

        update_task_status(task_id, 'processing')
        actual_content = _extract_content(pdf_path, task_id, marker_models)
        note_id = save_parsed_content(actual_content)
        update_task_status(task_id, 'completed', note_id=note_id)
        return {"task_id": task_id, "success": 1, "contents": actual_content, "message": "completed"}

    except Exception as e:
        print(f"Error processing task {task_id}: {e}")
        update_task_status(task_id, 'failed', error_msg=str(e))
        return {"task_id": task_id, "success": 0, "contents": "", "message": str(e)}
    finally:
        conn.close()
