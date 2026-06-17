import os
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form

GPU_BACKEND_URL = os.getenv("GPU_BACKEND_URL", "http://125.141.113.2:7001")

router = APIRouter(prefix="/pdf", tags=["PDF Extraction"])


@router.post("/extract")
async def extract_pdf(file: UploadFile = File(...), method: str = Form("marker")):
    """브라우저가 업로드한 PDF를 GPU Backend(/gpu/pdf/extract)로 프록시한다.

    https 페이지가 http GPU를 직접 호출하면 Mixed Content로 차단되므로,
    동일 출처인 백엔드를 경유해 GPU로 전달한다. (GPU 주소는 운영에서
    GPU_BACKEND_URL=본사 게이트웨이(/thinkcat)로 설정됨)
    """
    content = await file.read()
    files = {"file": (file.filename, content, file.content_type or "application/pdf")}
    data = {"method": method}
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            resp = await client.post(f"{GPU_BACKEND_URL}/gpu/pdf/extract", files=files, data=data)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        try:
            detail = e.response.json().get("detail")
        except Exception:
            detail = e.response.text
        raise HTTPException(status_code=e.response.status_code, detail=detail or "PDF 추출 실패")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"GPU Backend 연결 오류: {e}")
