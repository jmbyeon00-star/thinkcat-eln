import sys
sys.path.insert(0, '../backend')

import httpx
import asyncio
from app.core.config import settings

async def test():
    print(f"GPU_BACKEND_URL: {settings.GPU_BACKEND_URL}")

    # gpu_backend 직접 호출 테스트
    print("\n=== gpu_backend /gpu/invalidation/prepare 테스트 ===")
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                f"{settings.GPU_BACKEND_URL}/gpu/invalidation/prepare",
                json={"raw_text": "테스트 특허 텍스트입니다.", "section": "ALL", "n": 3}
            )
            print(f"status: {res.status_code}")
            print(f"response: {res.text[:500]}")
    except Exception as e:
        print(f"❌ 연결 실패: {e}")

asyncio.run(test())
