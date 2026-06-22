# 공고 크롤러 + 스케줄러 구조

ipforce 프로젝트의 SDI 스케줄러 구조를 참고하여 구현했습니다. (`jungmin/README.md` 참고)

## 포함 파일

| 파일 | 역할 |
|---|---|
| `crawler_utils.py` | 날짜 변환, 상태 계산, 중복 제거 공통 유틸 |
| `iris_crawler.py` | IRIS 오늘 날짜 공고 크롤링 (접수예정 + 접수중) |
| `sba_crawler.py` | 서울진흥원 현재 모집중 공고 크롤링 |

## 전체 구조

```
main.py                          ← lifespan에서 스케줄러 start/stop
  └─ announcement_service.py     ← BackgroundScheduler, _daily_job 정의
       └─ services/crawlers/     ← 크롤러 실제 로직
            ├─ iris_crawler.py
            └─ sba_crawler.py
```

## 스케줄러 동작 방식

### main.py — lifespan 연동
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    AnnouncementService.start()   # 서버 시작 시 스케줄러 켬
    yield                         # 서버 동작 중
    AnnouncementService.stop()    # 서버 종료 시 스케줄러 정리
```

### announcement_service.py — 스케줄러 정의
- `BackgroundScheduler` 사용 (별도 스레드에서 실행)
- `CronTrigger(hour=9, minute=0)` → 매일 09:00 KST 실행
- `SyncSessionLocal` 사용 (APScheduler는 별도 스레드라 async 세션 불가)

### _daily_job() 실행 순서
1. **마감 처리** — `end_date < 오늘` 인 항목 status → `'마감'`
2. **IRIS 크롤링** — 오늘 날짜 공고 수집 후 DB INSERT (URL 중복 스킵)
3. **SBA 크롤링** — 현재 모집중 공고 수집 후 DB INSERT (URL 중복 스킵)

## 크롤러별 특이사항

| | IRIS | SBA 서울진흥원 |
|---|---|---|
| 기준 | 오늘 등록된 공고 | 현재 모집중 전체 |
| 중단 조건 | 공고일이 오늘보다 이전이면 중단 | 모집중 항목 없는 페이지에서 중단 |
| 공고기관명 | 원본 기관명 그대로 | `'서울진흥원'` 고정 |
| budget | None (IRIS API 미제공) | None |

## SDI 스케줄러와의 차이점

| | SDI (ipforce) | 공고 스케줄러 (여기) |
|---|---|---|
| job 수 | 2개 (수집 02:00 / 매칭 03:00) | 1개 (09:00 통합 실행) |
| 세션 | `SyncSessionLocal` | `SyncSessionLocal` (동일) |
| 스케줄러 종류 | `BackgroundScheduler` | `BackgroundScheduler` (동일) |
