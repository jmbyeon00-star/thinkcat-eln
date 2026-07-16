# SDI 스케줄러 참고 자료

ipforce 프로젝트에서 SDI(신착특허 자동 수집/매칭) 기능에 사용된 스케줄러 구조를 참고용으로 정리했습니다.

## 포함 파일

| 파일 | 원본 경로 | 역할 |
|---|---|---|
| `scheduler.py` | `ipforce/backend/app/scheduler.py` | 스케줄러 정의 본체 (APScheduler) |
| `main.py` | `ipforce/backend/app/main.py` | FastAPI 앱과 스케줄러 라이프사이클 연동 |
| `sdi_service.py` | `ipforce/backend/app/api/services/sdi_service.py` | 스케줄 job이 호출하는 실제 비즈니스 로직 |
| `sdi_model.py` | `ipforce/backend/app/models/sdi_model.py` | 관련 ORM 모델 (`SdiNewPatent`, `SdiSearchQuery` 등) |

## 구조 요약

### 1. scheduler.py — 스케줄러 정의
- `apscheduler.schedulers.background.BackgroundScheduler` 사용
- `CronTrigger` + `ZoneInfo("Asia/Seoul")`로 KST 기준 시간 지정
- 등록된 job
  - **매일 02:00** `_collect_and_index()` → KIPRIS 신착특허 수집 → DB upsert → ES 인덱싱 (`sdi_service.collect_patents`)
  - **매일 03:00** `_match_and_classify()` → 활성 검색식 매칭 + 분류 추론 (`sdi_service.match_queries`)
- `start()` / `stop()` 두 함수만 외부에 노출

```python
def start():
    _scheduler.add_job(_collect_and_index, CronTrigger(hour=2, minute=0), id="sdi_collect", replace_existing=True)
    _scheduler.add_job(_match_and_classify, CronTrigger(hour=3, minute=0), id="sdi_match", replace_existing=True)
    _scheduler.start()

def stop():
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
```

### 2. main.py — FastAPI 라이프사이클 연동
`lifespan` 컨텍스트 매니저로 앱 시작/종료에 스케줄러를 맞물림.

```python
from app import scheduler as sdi_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    sdi_scheduler.start()
    yield
    sdi_scheduler.stop()

app = FastAPI(title="ipforce_next API", version="0.1.0", lifespan=lifespan)
```

### 3. sdi_service.py — job이 호출하는 실제 로직
- `collect_patents()`: KIPRIS API 호출(`_fetch_kipris`) → DB row 변환(`_to_db_row`) → ES 벌크 인덱싱(`_bulk_index`)
- `match_queries()`: 등록된 검색식(`SdiSearchQuery`)을 순회하며 매칭(`_match_single_query`) 및 자동 푸시(`_auto_push_matched`) 처리
- 스케줄러는 이 서비스 함수들을 단순 호출만 하고, 비즈니스 로직은 서비스 레이어에 분리되어 있음

## 설계 포인트 (참고할 만한 부분)

1. **관심사 분리** — 스케줄링(타이밍/트리거)과 비즈니스 로직(서비스 레이어)을 분리. `scheduler.py`는 "언제 실행할지"만 알고, "무엇을 할지"는 모름.
2. **세션 관리** — 각 job 함수 내부에서 동기 DB 세션(`SyncSessionLocal`)을 직접 열고 `try/finally`로 반드시 닫음. APScheduler는 별도 스레드에서 job을 실행하므로 FastAPI의 요청 스코프 세션을 재사용할 수 없어 별도 sync 세션을 사용.
3. **예외 격리** — job 내부에서 예외를 잡아 로깅만 하고 삼킴. 한 job이 실패해도 스케줄러 자체나 다음 실행에 영향이 없도록 함.
4. **라이프사이클 연동** — FastAPI `lifespan`에서 `start()`/`stop()`만 호출. 앱이 여러 워커로 뜨는 환경이라면 중복 실행 방지(예: 단일 워커에서만 스케줄러 기동) 여부를 확인 필요.
5. **타임존 명시** — `BackgroundScheduler(timezone=ZoneInfo("Asia/Seoul"))`로 서버 환경과 무관하게 KST 기준으로 동작하도록 고정.

## 참고 시 주의할 점

- 이 코드는 SDI 도메인에 특화되어 있어 (`sdi_service` 직접 import) 다른 기능에 재사용하려면 일반화가 필요합니다.
- 멀티 프로세스/워커 환경에서는 스케줄러가 워커마다 중복 기동될 수 있으니, 신규 기능 설계 시 단일 인스턴스 보장 방법(예: 분산 락, 별도 워커 프로세스)을 검토하는 것을 권장합니다.
