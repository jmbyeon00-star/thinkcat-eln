# invalidation_router async 전환 계획

## 왜 해야 하나

`async def event_stream()` 안에 sync DB 쿼리(`db.query(...)`)가 67개 있음.
`await` 없이 sync 함수를 호출하면 이벤트루프 전체가 블록 → 다른 요청 대기.

---

## 변경해야 할 파일 (3개)

```
backend/app/
├── api/routers/invalidation_router.py       ← 메인 작업 (2000줄)
├── crud/crud_invalidation_history.py        ← sync → async 전환
└── services/invalidation/patent_parser.py  ← DB 받는 함수들 async 전환
```

---

## 1. invalidation_router.py

### import 변경

```python
# 지금
from sqlalchemy.orm import Session
from app.core.db import get_sync_session

# 변경 후
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.db import get_async_session
```

### 엔드포인트 시그니처 변경 (전체)

```python
# 지금
db: Session = Depends(get_sync_session)

# 변경 후
db: AsyncSession = Depends(get_async_session)
```

### DB 쿼리 패턴 변경

**단건 조회 (first)**
```python
# 지금
cached = db.query(InvalPrepareCacheDB).filter(
    InvalPrepareCacheDB.base_id == base_id
).first()

# 변경 후
result = await db.execute(
    select(InvalPrepareCacheDB).where(InvalPrepareCacheDB.base_id == base_id)
)
cached = result.scalars().first()
```

**다건 조회 (all)**
```python
# 지금
existing = db.query(InvalElementDB).filter(
    InvalElementDB.application_number == app_num,
    InvalElementDB.base_app_number == base_id,
    InvalElementDB.model == model,
).all()

# 변경 후
result = await db.execute(
    select(InvalElementDB).where(
        InvalElementDB.application_number == app_num,
        InvalElementDB.base_app_number == base_id,
        InvalElementDB.model == model,
    )
)
existing = result.scalars().all()
```

**단건 조회 (filter + order_by)**
```python
# 지금
cached = db.query(InvalPriorArtReportDB).filter(
    InvalPriorArtReportDB.base_id == report_cache_key,
    InvalPriorArtReportDB.model == model,
).order_by(InvalPriorArtReportDB.created_at.desc()).first()

# 변경 후
result = await db.execute(
    select(InvalPriorArtReportDB)
    .where(
        InvalPriorArtReportDB.base_id == report_cache_key,
        InvalPriorArtReportDB.model == model,
    )
    .order_by(InvalPriorArtReportDB.created_at.desc())
)
cached = result.scalars().first()
```

**추가/저장**
```python
# 지금
db.add(InvalPrepareCacheDB(...))
db.commit()

# 변경 후 (add는 동일, commit만 await)
db.add(InvalPrepareCacheDB(...))
await db.commit()
```

**rollback**
```python
# 지금
db.rollback()

# 변경 후
await db.rollback()
```

---

## 2. crud_invalidation_history.py

모든 함수가 sync → async로 바뀌어야 함.

```python
# 지금
def create_idea_history(db: Session, ...):
    db.add(...)
    db.commit()

# 변경 후
async def create_idea_history(db: AsyncSession, ...):
    db.add(...)
    await db.commit()
```

변경 대상 함수 5개:
- `create_idea_history`
- `update_idea_history_result`
- `get_idea_history_list`
- `get_idea_history_detail`
- `delete_idea_history`

라우터에서 호출할 때도 `await` 추가:
```python
# 지금
create_idea_history(db, ...)

# 변경 후
await create_idea_history(db, ...)
```

---

## 3. patent_parser.py

DB를 받는 함수들만 async 전환. DB 없는 함수는 그대로.

```python
# 지금
def get_patent_info(app_number: str, db: Session) -> dict | None:
    result = db.query(PatentResult).filter(...).first()

# 변경 후
async def get_patent_info(app_number: str, db: AsyncSession) -> dict | None:
    result = await db.execute(select(PatentResult).where(...))
    return result.scalars().first()
```

변경 대상 함수:
- `get_patent_info` (db 받음)
- `get_prior_patents_info` (db 받음)

변경 불필요 함수 (db 안 받음):
- `get_similar_patents`
- `get_claims`
- `parse_base`
- `parse_prior`

라우터에서 호출 시 `await` 추가:
```python
# 지금
prior_info = patent_parser.get_patent_info(app_num, db)

# 변경 후
prior_info = await patent_parser.get_patent_info(app_num, db)
```

---

## 작업 순서

- [ ] `patent_parser.py` — `get_patent_info`, `get_prior_patents_info` async 전환
- [ ] `crud_invalidation_history.py` — 5개 함수 전체 async 전환
- [ ] `invalidation_router.py`
  - [ ] import 변경
  - [ ] 모든 엔드포인트 시그니처 `get_async_session`으로 변경
  - [ ] `db.query()` 67개 → `await db.execute(select(...))` 패턴으로 변경
  - [ ] `db.commit()` → `await db.commit()`
  - [ ] `db.rollback()` → `await db.rollback()`
  - [ ] crud 함수 호출부 `await` 추가
  - [ ] patent_parser 함수 호출부 `await` 추가

## 주의사항

- `_save_elements()` 같은 내부 헬퍼 함수도 `async def`로 바꾸고 `await` 필요
- `async def event_stream()` 안에서 호출되는 내부 함수들도 전부 체크
- `announcement_router.py`를 참고 예시로 쓰면 됨
