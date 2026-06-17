_marker_models = None


def _load_marker_models():
    global _marker_models
    if _marker_models is None:
        print("[PDF] marker-pdf 모델 로딩 중...")
        from marker.models import load_all_models
        _marker_models = load_all_models()
        print("[PDF] marker-pdf 모델 로딩 완료")
    return _marker_models


async def extract_with_marker(file_path: str, marker_models=None) -> dict:
    from marker.convert import convert_single_pdf

    models = marker_models if marker_models is not None else _load_marker_models()
    full_text, _images, out_meta = convert_single_pdf(file_path, models, batch_multiplier=2)

    return {
        "method": "marker",
        "text": full_text,
        "pages": out_meta.get("pages", 0),
        "language": out_meta.get("languages", []),
    }


async def extract_pdf(file_path: str, method: str, model=None, marker_models=None) -> dict:
    if method == "marker":
        return await extract_with_marker(file_path, marker_models)
    raise ValueError(f"지원하지 않는 추출 방식: {method}. marker만 지원합니다.")
