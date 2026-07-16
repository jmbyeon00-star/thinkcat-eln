# invalidation async 전환 변경사항

---

## 1. patent_parser.py ✅

### import

**이전**
```python
from sqlalchemy.orm import Session
from sqlalchemy import or_
```

**이후**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
```

---

### get_patent_info

**이전**
```python
def get_patent_info(app_number: str, db: Session) -> dict | None:
    row = db.query(PatentResult).filter(
        PatentResult.application_number == app_number
    ).first()
    if not row:
        return None
    return { ... }
```

**이후**
```python
async def get_patent_info(app_number: str, db: AsyncSession) -> dict | None:
    result = await db.execute(
        select(PatentResult).where(PatentResult.application_number == app_number)
    )
    row = result.scalars().first()
    if not row:
        return None
    return { ... }
```

---

### get_prior_patents_info

**이전**
```python
def get_prior_patents_info(similar_ids, base_filing_date, db: Session, ...):
    query = db.query(PatentResult).filter(
        PatentResult.application_number.in_(similar_ids),
        PatentResult.filing_date < base_filing_date,
    )
    if base_family_application_number:
        query = query.filter(or_(...))
    rows = query.all()
    ...
```

**이후**
```python
async def get_prior_patents_info(similar_ids, base_filing_date, db: AsyncSession, ...):
    stmt = select(PatentResult).where(
        PatentResult.application_number.in_(similar_ids),
        PatentResult.filing_date < base_filing_date,
    )
    if base_family_application_number:
        stmt = stmt.where(or_(...))
    result = await db.execute(stmt)
    rows = result.scalars().all()
    ...
```

---

## 2. crud_invalidation_history.py ✅

### import

**이전**
```python
from sqlalchemy.orm import Session
```
**이후**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
```

---

### create_idea_history

**이전**
```python
def create_idea_history(db: Session, ...):
    db.add(InvalIdeaHistoryDB(...))
    db.commit()
    ...
    db.rollback()
```
**이후**
```python
async def create_idea_history(db: AsyncSession, ...):
    db.add(InvalIdeaHistoryDB(...))
    await db.commit()
    ...
    await db.rollback()
```

---

### update_idea_history_result

**이전**
```python
def update_idea_history_result(db: Session, ...):
    history = db.query(InvalIdeaHistoryDB).filter(...).first()
    ...
    db.commit()
    db.rollback()
```
**이후**
```python
async def update_idea_history_result(db: AsyncSession, ...):
    result = await db.execute(select(InvalIdeaHistoryDB).where(...))
    history = result.scalars().first()
    ...
    await db.commit()
    await db.rollback()
```

---

### get_idea_history_list

**이전**
```python
def get_idea_history_list(db: Session, ...):
    rows = db.query(InvalIdeaHistoryDB).filter(...).order_by(...).offset(...).limit(...).all()
```
**이후**
```python
async def get_idea_history_list(db: AsyncSession, ...):
    result = await db.execute(select(InvalIdeaHistoryDB).where(...).order_by(...).offset(...).limit(...))
    rows = result.scalars().all()
```

---

### get_idea_history_detail

**이전**
```python
def get_idea_history_detail(db: Session, ...):
    history = db.query(InvalIdeaHistoryDB).filter(...).first()
    cached  = db.query(InvalPriorArtReportDB).filter(...).order_by(...).first()
    prepare_cache = db.query(InvalPrepareCacheDB).filter(...).first()
```
**이후**
```python
async def get_idea_history_detail(db: AsyncSession, ...):
    result  = await db.execute(select(InvalIdeaHistoryDB).where(...))
    history = result.scalars().first()
    cached_result = await db.execute(select(InvalPriorArtReportDB).where(...).order_by(...))
    cached  = cached_result.scalars().first()
    prepare_result = await db.execute(select(InvalPrepareCacheDB).where(...))
    prepare_cache  = prepare_result.scalars().first()
```

---

### delete_idea_history

**이전**
```python
def delete_idea_history(db: Session, ...):
    history = db.query(InvalIdeaHistoryDB).filter(...).first()
    db.delete(history)
    db.commit()
```
**이후**
```python
async def delete_idea_history(db: AsyncSession, ...):
    result  = await db.execute(select(InvalIdeaHistoryDB).where(...))
    history = result.scalars().first()
    await db.delete(history)
    await db.commit()
```

---

## 3. invalidation_router.py ✅

### import

**이전**
```python
from sqlalchemy.orm import Session
from app.core.db import get_sync_session
```
**이후**
```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.db import get_async_session
```

### 변경 패턴 요약

| 패턴 | 이전 | 이후 |
|------|------|------|
| 엔드포인트 | `def foo(db: Session = Depends(get_sync_session))` | `async def foo(db: AsyncSession = Depends(get_async_session))` |
| 단건 조회 | `db.query(M).filter(...).first()` | `(await db.execute(select(M).where(...))).scalars().first()` |
| 다건 조회 | `db.query(M).filter(...).all()` | `(await db.execute(select(M).where(...))).scalars().all()` |
| 벌크 삭제 | `db.query(M).filter(...).delete(synchronize_session=False)` | `await db.execute(delete(M).where(...))` |
| 저장 | `db.commit()` | `await db.commit()` |
| 롤백 | `db.rollback()` | `await db.rollback()` |
| refresh | `db.refresh(obj)` | `await db.refresh(obj)` |
| crud 호출 | `create_idea_history(db, ...)` | `await create_idea_history(db, ...)` |
| patent_parser | `patent_parser.get_patent_info(n, db)` | `await patent_parser.get_patent_info(n, db)` |
| 헬퍼 함수 | `def _save_elements(db: Session, ...)` | `async def _save_elements(db: AsyncSession, ...)` |

### 추가 변경 사항

- `_save_elements`: `def` → `async def`, bulk delete → `await db.execute(delete(...))`
- `_load_overrides`: `def` → `async def`
- `_generate_interpretation`: `def` → `async def`, `httpx.post` → `async with httpx.AsyncClient`
- `extract_from_claims`: sync httpx → async httpx (`AsyncClient`)
- 모든 내부 헬퍼 호출부에 `await` 추가