# 크레딧 시스템 리팩토링 계획 (v4 - 확정)

## 핵심 원칙

- 크레딧은 **organization 단위** 차감 (CREDIT_TB.organization_id 기준)
- 내역은 organization + requested_by_user_id 함께 기록
- `owner_user_id`는 권한/책임자 식별 용도 (크레딧 로직에 미사용)
- `USER_INFO_TB.trial_started` 제거

---

## 플랜 정의

| 플랜 | 크레딧 | 기간 | 최대 멤버 |
|------|--------|------|----------|
| trial | 1회 (총량) | 14일 | 3명 |
| bronze | 3건/월 | 연간 | 3명 |
| silver | 5건/월 | 연간 | 5명 |
| gold | 10건/월 | 연간 | 10명 |

---

## 확정 DB 스키마

### ORGANIZATION_TB
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | INT PK | |
| name | VARCHAR | |
| owner_user_id | INT | 책임자 (권한 관리용) |
| plan_id | INT NULL | 활성 플랜. **NULL = 만료** |
| trial_started_at | DATETIME NULL | trial 시작 시각 |
| trial_expires_at | DATETIME NULL | trial 만료 시각 (+14일) |
| subscription_end | DATETIME NULL | 연간 구독 종료일 (유료 플랜만) |
| created_at | DATETIME | |

### CREDIT_TB (USER_CREDIT_TB 대체)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| organization_id | INT PK | FK → ORGANIZATION_TB.id |
| credits_total | INT | 이번 달 총 발급량 |
| credits_remaining | INT | 이번 달 잔여량 |
| period_start | DATETIME | 현재 크레딧 기간 시작 |
| period_end | DATETIME | 현재 크레딧 기간 종료 (다음 리셋일) |
| updated_at | DATETIME | |

### USER_INFO_TB 변경
- `trial_started` 제거
- `organization_id`, `org_role` (owner/member) 유지

### USAGE_LOGS_TB 변경
- `user_id` → `requested_by_user_id`

### INVAL_IDEA_HISTORY_TB 변경
- `user_id` → `requested_by_user_id`
- `organization_id` 컬럼 추가

---

## DB 마이그레이션 SQL

```sql
-- 1. USER_INFO_TB
ALTER TABLE USER_INFO_TB DROP COLUMN trial_started;

-- 2. ORGANIZATION_TB
ALTER TABLE ORGANIZATION_TB
  ADD COLUMN trial_started_at  DATETIME NULL,
  ADD COLUMN trial_expires_at  DATETIME NULL,
  ADD COLUMN subscription_end  DATETIME NULL;
-- 기존 credit_expire_at, period_end 제거 (CREDIT_TB로 이동)
ALTER TABLE ORGANIZATION_TB
  DROP COLUMN credit_expire_at,
  DROP COLUMN period_end;

-- 3. CREDIT_TB (USER_CREDIT_TB 재구성)
ALTER TABLE USER_CREDIT_TB DROP PRIMARY KEY;
ALTER TABLE USER_CREDIT_TB DROP INDEX idx_credit_expire;
ALTER TABLE USER_CREDIT_TB CHANGE user_id organization_id INT NOT NULL;
ALTER TABLE USER_CREDIT_TB CHANGE credit_expire_at period_end DATETIME NOT NULL;
ALTER TABLE USER_CREDIT_TB ADD COLUMN period_start DATETIME NOT NULL DEFAULT NOW();
ALTER TABLE USER_CREDIT_TB ADD PRIMARY KEY (organization_id);
ALTER TABLE USER_CREDIT_TB ADD INDEX idx_credit_period_end (period_end);
RENAME TABLE USER_CREDIT_TB TO CREDIT_TB;

-- 4. USAGE_LOGS_TB
ALTER TABLE USAGE_LOGS_TB CHANGE user_id requested_by_user_id INT NOT NULL;

-- 5. INVAL_IDEA_HISTORY_TB
ALTER TABLE INVAL_IDEA_HISTORY_TB CHANGE user_id requested_by_user_id INT NOT NULL;
ALTER TABLE INVAL_IDEA_HISTORY_TB ADD COLUMN organization_id INT NULL;
ALTER TABLE INVAL_IDEA_HISTORY_TB ADD INDEX idx_inval_idea_history_org (organization_id);
```

---

## check_and_refresh 로직

```
user.organization_id 없음
  → no_subscription

org.plan_id == NULL
  → trial_expires_at 있음 → expired_trial
  → trial_expires_at 없음 → expired_subscription

org.plan_id == trial
  → CREDIT_TB(org_id).credits_remaining == 0 → no_credits
  → ok

org.plan_id == bronze/silver/gold
  → CREDIT_TB(org_id).credits_total == 0 → expired_subscription
  → CREDIT_TB(org_id).credits_remaining == 0 → no_credits
  → ok
```

---

## 스케줄러 로직

### trial 만료 (매일 01:00)
```
ORGANIZATION_TB WHERE plan_id=trial AND trial_expires_at <= 오늘
→ plan_id = NULL
→ CREDIT_TB.credits_remaining = 0, credits_total = 0
```

### 유료 플랜 월별 처리 (매일 01:00)
```
ORGANIZATION_TB WHERE plan_id IN (bronze/silver/gold)
JOIN CREDIT_TB WHERE period_end == 오늘
→ period_end == subscription_end
    → 연간 만료: plan_id=NULL, credits=0
→ 아니면
    → 월 리셋: credits=plan.monthly_credits, period_start=오늘, period_end+=1개월
```

---

## 코드 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `models/subscription.py` | UserCreditDB → CreditDB (organization_id PK, period_start/end), OrganizationDB 컬럼 추가 |
| `models/user.py` | trial_started 제거 |
| `models/invalidation.py` | InvalIdeaHistoryDB.user_id → requested_by_user_id, organization_id 추가 |
| `crud/crud_credit.py` | start_trial, start_subscription, check_and_refresh, decrement_credit 전면 재작성 |
| `crud/crud_invalidation_history.py` | user_id → requested_by_user_id, organization_id 추가 |
| `services/credit_scheduler.py` | CREDIT_TB 기준으로 재작성 |
| `api/routers/invalidation_router.py` | org_id 기반 호출로 변경 |
