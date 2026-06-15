import os
import tempfile
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request
from app.services import pdf_service

router = APIRouter(prefix="/pdf", tags=["PDF Extraction"])

ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}
MAX_FILE_SIZE_MB = 50


@router.post("/extract")
async def extract_pdf(
    request: Request,
    file: UploadFile = File(...),
    method: str = Form("marker"),
):
    content_type = file.content_type or ""
    if content_type not in ALLOWED_CONTENT_TYPES and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")

    if method != "marker":
        raise HTTPException(status_code=400, detail="method는 marker만 지원합니다.")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"파일 크기가 {MAX_FILE_SIZE_MB}MB를 초과합니다.")

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        marker_models = getattr(request.app.state, "marker_models", None)
        result = await pdf_service.extract_pdf(tmp_path, method, None, marker_models)
        result["filename"] = file.filename
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF 추출 오류: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)


@router.get("/methods")
async def get_available_methods():
    return {
        "methods": [
            {"id": "marker", "name": "Marker-PDF", "description": "PDF→Markdown 변환. 일반 문서, 보고서에 최적.", "supports_math": False, "speed": "빠름"},
        ]
    }
