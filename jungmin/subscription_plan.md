# 구독/크레딧 시스템 구현 계획

## 개요

선행기술조사(아이디어 기반) 기능에 크레딧 기반 사용 제한을 도입한다.

- 조사 1회 = 크레딧 1회 차감
- 구독 기간 내 본인이 조회한 동일 아이디어 재조회는 무료
- 무료 체험과 구독 플랜은 완전히 분리된 로직으로 동작
- **로그인/회원가입은 별도 담당. 본 구현은 `user_id`가 주어진다고 가정.**

---

## 1. 사용자 상태 구분

| 상태 | 설명 | organization_id | trial_started |
|------|------|----------------|---------------|
| 신규 | 가입 직후, 아무것도 안 한 상태 | null | False |
| 무료 체험 중 | 체험 버튼 클릭 후 | null | True |
| 구독 중 | 팀/개인 구독 플랜 가입 | org_id 존재 | - |
| 만료 | valid_until 또는 period_end 초과 | - | - |

---

## 2. 플랜 구조

### 무료 체험
- 회원가입 완료 후 "무료 체험 시작" 버튼 클릭 시 발동
- 크레딧 2회, 유효기간 +1개월
- ORGANIZATION_TB 없음 (개인 단위)
- `trial_started = True` 세팅으로 중복 지급 방지
- 만료 후 재지급 없음 → 구독 플랜으로 전환해야 함

### 구독 플랜
팀 인원 수에 따라 인당 월 크레딧 자동 결정. plan_code 없이 인원 수에서 직접 계산.

| 팀 인원 | 인당 월 크레딧 | 결제 단위 |
|---------|--------------|---------|
| 1명     | 2회/월       | 월 단위  |
| 2~5명   | 5회/월       | 연 단위  |
| 6~10명  | 10회/월      | 연 단위  |

```python
def _monthly_credits(member_count: int) -> int:
    if member_count >= 6: return 10
    if member_count >= 2: return 5
    return 2  # 1명 개인 플랜

def _subscription_period_months(member_count: int) -> int:
    return 1 if member_count == 1 else 12
```

### reset_at vs period_end 관계
```
예: 5인 팀, 6개월 구독, 2026-07-01 시작

period_end = 2027-01-01   ← 구독 전체 만료일 (고정)
reset_at   = 2026-08-01   ← 다음 월 크레딧 리셋 시점 (매월 갱신)

매월 reset_at 도달 → credits를 플랜 기준값으로 리셋, reset_at += 1개월
period_end 도달   → 리셋 없음, 이후 모든 요청 403
```

### 플랜 변경 정책
- `period_end` 만료 후에만 변경 가능
- 구독 중 팀원 추가/삭제는 크레딧에 즉시 반영하지 않음

---

## 3. 테이블 구조 (총 9개)

### 신규 테이블 3개

#### ORGANIZATION_TB
```sql
id            INT PK AUTO_INCREMENT
name          VARCHAR(100)
owner_user_id INT FK → USER_INFO_TB
reset_at      DATETIME    -- 다음 월 크레딧 리셋 시점 (매월 갱신)
period_end    DATETIME    -- 구독 전체 만료일 (고정)
created_at    DATETIME
```

#### USER_CREDIT_TB
```sql
user_id           INT PK FK → USER_INFO_TB
credits_remaining INT DEFAULT 0
credits_total     INT DEFAULT 0    -- 이번 달(또는 체험) 지급 총량
valid_until       DATETIME         -- 무료 체험: +1개월 / 구독: 현재 reset_at
updated_at        DATETIME
```

> 무료 체험과 구독 모두 이 테이블 하나로 관리.
> 구독 여부는 `USER_INFO_TB.organization_id` 유무로 구분.

#### USAGE_LOGS_TB
```sql
id              BIGINT PK AUTO_INCREMENT
user_id         INT FK → USER_INFO_TB
organization_id INT FK nullable
base_id         VARCHAR(120)
action          VARCHAR(50)      -- 고정 4종 (아래 참조)
reason          VARCHAR(50) nullable  -- 만료 사유 세분화 ('expired_trial' / 'expired_subscription')
credits_used    INT DEFAULT 0
history_id      BIGINT FK nullable → INVAL_IDEA_HISTORY_TB
created_at      DATETIME
```

**action 값 (고정 5종) + reason 정의**

| action | reason | 설명 | credits_used |
|--------|--------|------|-------------|
| `prior_art_search` | null | 최초 조회, 크레딧 차감 | 1 |
| `prior_art_search_cached` | null | 본인 동일 base_id 재조회 (무료) | 0 |
| `prior_art_search_expired` | `expired_trial` | 무료 체험 기간 종료로 차단 | 0 |
| `prior_art_search_expired` | `expired_subscription` | 구독 기간 종료로 차단 | 0 |
| `prior_art_search_no_credits` | `monthly_limit_reached` | 이번 달 크레딧 전부 소진 | 0 |
| `prior_art_search_failed` | `gpu_timeout` | GPU 분석 시간 초과 | 0 |
| `prior_art_search_failed` | `gpu_error` | GPU 내부 오류 | 0 |
| `prior_art_search_failed` | `invalid_input` | 잘못된 요청 파라미터 | 0 |

> `reason`은 차단/실패 이벤트 전체에 일관되게 적용. 성공/캐시는 null.
> `prior_art_search_no_credits` + `monthly_limit_reached` 조합은 업셀링 분석 및 플랜 추천에 활용.

### 기존 테이블 수정 2개

#### USER_INFO_TB
```sql
+ organization_id  INT FK nullable → ORGANIZATION_TB
+ org_role         ENUM('owner', 'member') nullable  -- 무료 체험/개인은 null
+ trial_started    BOOLEAN DEFAULT False              -- 무료 체험 중복 지급 방지
```

#### INVAL_IDEA_HISTORY_TB
```sql
+ status         VARCHAR(20) DEFAULT 'success'   -- 'success' / 'failed'
+ error_message  TEXT nullable                   -- GPU 실패 원인 저장
```

### 기존 테이블 유지 4개 (공유 캐시)
- INVAL_PREPARE_CACHE_TB
- INVAL_PRIOR_ART_REPORT_TB
- INVAL_ELEMENT_TB
- INVAL_PAIR_ANALYSIS_TB

---

## 4. 크레딧 로직 함수 (`crud_credit.py`)

모든 함수는 `user_id`를 파라미터로 받는다. 로그인 로직 완성 후 그대로 연동 가능.

```python
async def assign_free_trial(db, user_id: int) -> bool:
    """
    무료 체험 시작 버튼 클릭 시 호출.
    trial_started=True이면 무시하고 False 반환.
    USER_CREDIT_TB: credits=2, valid_until=+1개월 세팅.
    USER_INFO_TB: trial_started=True 세팅.
    """

async def start_subscription(db, org_id: int, user_ids: list[int]) -> None:
    """
    구독 플랜 가입 시 호출.
    ORGANIZATION_TB: reset_at, period_end 세팅.
    USER_CREDIT_TB: 팀 인원 수 기반 monthly_credits 지급.
    """

async def check_and_refresh(db, user_id: int) -> tuple[bool, str]:
    """
    조사 실행 전 호출. 순서:
      1. organization_id 있으면 → period_end 확인 → 만료 시 ('expired_subscription')
      2. organization_id 있으면 → reset_at 확인 → 도달 시 크레딧 리셋
      3. valid_until 확인 → 무료 체험 만료 시 ('expired_trial')
      4. credits_remaining 확인 → 0이면 ('no_credits')
    반환: (True, 'ok') 또는 (False, 'expired_subscription'|'expired_trial'|'no_credits')
    """

async def is_cached_for_user(db, user_id: int, base_id: str) -> bool:
    """
    USAGE_LOGS_TB에서 user_id + base_id 조합 조회.
    있으면 True (재조회 → 무료).
    """

async def decrement_credit(db, user_id: int, base_id: str,
                           history_id: int, org_id: int | None) -> bool:
    """
    크레딧 atomic 차감 + USAGE_LOGS 기록 (단일 트랜잭션).
    SQL: UPDATE ... SET credits_remaining -= 1 WHERE credits_remaining > 0
    업데이트 행 0개 → False (동시 요청 충돌)
    """

async def log_usage(db, user_id: int, base_id: str, action: str,
                    reason: str | None = None,
                    history_id: int | None = None,
                    org_id: int | None = None) -> None:
    """
    차감 없는 이벤트 로그 기록.
    모든 차단/실패 이벤트에 reason을 일관되게 전달:
      expired_trial / expired_subscription / monthly_limit_reached
      gpu_timeout / gpu_error / invalid_input
    성공/캐시는 reason=None.
    """
```

---

## 5. 조사 실행 흐름 (invalidation_router.py 수정 범위)

### 403 응답 메시지 구조

모든 403은 `detail` 필드에 공통 구조로 응답. 프론트엔드는 `code`로 분기해 UX 처리.

```json
// 구독 만료
{ "code": "subscription_expired", "message": "구독이 만료되었습니다" }

// 체험 만료
{ "code": "trial_expired", "message": "무료 체험이 종료되었습니다" }

// 크레딧 소진 — next_reset_at 포함 (프론트: "N일 후 초기화" 안내)
{ "code": "no_credits", "message": "이번 달 조사 횟수를 모두 사용했습니다", "next_reset_at": "2026-08-01T00:00:00" }
```

| code | 프론트 안내 | next_reset_at |
|------|-----------|---------------|
| `subscription_expired` | "구독 플랜 갱신 필요" 버튼 표시 | 없음 |
| `trial_expired` | "구독 플랜 가입 필요" 버튼 표시 | 없음 |
| `no_credits` | 리셋 예정일 표시 ("N일 후 초기화") | 있음 (org.reset_at) |

### 흐름

```
① check_and_refresh(user_id)
   └ 'expired_subscription'
       → log_usage(..., 'prior_art_search_expired', reason='expired_subscription')
       → 403 { code: 'subscription_expired' }
   └ 'expired_trial'
       → log_usage(..., 'prior_art_search_expired', reason='expired_trial')
       → 403 { code: 'trial_expired' }
   └ 'no_credits'
       → log_usage(..., 'prior_art_search_no_credits', reason='monthly_limit_reached')
       → 403 { code: 'no_credits', next_reset_at: org.reset_at }
   └ 'ok' → 계속

② is_cached_for_user(user_id, base_id)
   └ True  → 캐시 결과 반환
            → log_usage(..., 'prior_art_search_cached')
            → 종료
   └ False → 최초 조회, 계속

③ PREPARE_CACHE / PRIOR_ART_REPORT 캐시 조회
   └ 히트 → GPU 생략
   └ 미스 → GPU 분석 실행

④ GPU 실패 시 (실패 유형별 reason 분기)
   └ asyncio.TimeoutError → reason='gpu_timeout'
   └ 파라미터 검증 실패  → reason='invalid_input'
   └ 그 외 예외          → reason='gpu_error'
   └ IDEA_HISTORY status='failed', error_message=str(e)
   └ log_usage(..., 'prior_art_search_failed', reason=reason)
   └ 500 반환 (크레딧 차감 없음)

⑤ 결과 저장
   └ IDEA_HISTORY status='success'

⑥ decrement_credit(user_id, base_id, history_id, org_id)
   └ False → 409 (동시 요청 충돌)
   └ True  → 정상 응답
```

---

## 6. 구현 범위 정리

| 항목 | 담당 | 비고 |
|------|------|------|
| 로그인/회원가입 | 별도 담당 | user_id만 받아서 연동 |
| 무료 체험 시작 버튼 | **본 구현** | `assign_free_trial(user_id)` |
| 구독 플랜 가입 | **본 구현** | `start_subscription(org_id, user_ids)` |
| 조사 실행 크레딧 흐름 | **본 구현** | invalidation_router stream 수정 |
| 월별 리셋 | **본 구현** | `check_and_refresh` 내부 처리 |
| 구독 갱신/해지 권한 체크 | **본 구현** | org_role='owner'인 경우에만 허용, API 레벨에서 검증 |

### owner 권한 체크 규칙

```python
# 구독 갱신 / 해지 / 팀원 초대 엔드포인트에서
user = await db.get(User, user_id)
if user.org_role != 'owner':
    raise HTTPException(403, "팀 관리 권한이 없습니다")
```

`member`는 조사 실행 및 히스토리 조회만 가능. 구독 관련 변경은 `owner`만.

---

## 7. 구현 순서

1. `models/subscription.py` — ORGANIZATION_TB, USER_CREDIT_TB, USAGE_LOGS_TB 모델
2. `models/user.py` — organization_id, org_role, trial_started 추가
3. `models/invalidation.py` — status, error_message 추가
4. DB 마이그레이션 (CREATE TABLE 3개 + ALTER TABLE 2개)
5. `crud/crud_credit.py` — 크레딧 함수 6개
6. `routers/invalidation_router.py` — stream 엔드포인트 크레딧 흐름 삽입
7. `routers/user_router.py` — 무료 체험 시작 엔드포인트 추가
