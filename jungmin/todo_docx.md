# Word 다운로드 구현 TODO

## 즉시
- [x] `.env` — `UVICORN_WORKERS=4` 추가
- [x] `backend/requirements.txt` — `python-docx` 추가

## 백엔드
- [x] `backend/app/services/invalidation/docx_generator.py` 신규
- [x] `backend/app/api/routers/invalidation_router.py` — `POST /export/docx` 추가

## 프론트엔드
- [x] `frontend/lib/invalidation_api.ts` — `invalExportDocx(prepareData, report)` 추가
- [x] `frontend/app/[locale]/prior-art/report/page.tsx` — "Word 저장" 버튼 추가
