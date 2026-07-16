# 크레딧 시스템 리팩토링 체크리스트

## Phase 1: DB 마이그레이션

- [x] **1-1** `USER_INFO_TB.trial_started` 제거
- [x] **1-2** `ORGANIZATION_TB` 컬럼 추가/제거
  - ADD: `trial_started_at`, `trial_expires_at`, `subscription_end`
  - DROP: `credit_expire_at`, `period_end`
- [x] **1-3** `USER_CREDIT_TB` → `CREDIT_TB` 재구성
  - PK: `user_id` → `organization_id`
  - RENAME: `credit_expire_at` → `period_end`
  - ADD: `period_start`
  - DROP INDEX / ADD INDEX
  - RENAME TABLE
- [x] **1-4** `USAGE_LOGS_TB.user_id` → `requested_by_user_id`
- [x] **1-5** `INVAL_IDEA_HISTORY_TB.user_id` → `requested_by_user_id`, `organization_id` 추가
- [ ] **1-6** DB 확인 (각 테이블 `DESC` 또는 `SHOW COLUMNS`)

---

## Phase 2: 모델 수정

- [x] **2-1** `backend/app/models/subscription.py`
  - `UserCreditDB` → `CreditDB` (organization_id PK, period_start, period_end)
  - `OrganizationDB`: trial_started_at, trial_expires_at, subscription_end 추가 / credit_expire_at, period_end 제거
- [x] **2-2** `backend/app/models/user.py`
  - `trial_started` 제거
- [x] **2-3** `backend/app/models/invalidation.py`
  - `InvalIdeaHistoryDB.user_id` → `requested_by_user_id`
  - `organization_id` 컬럼 추가
- [x] **2-4** `backend/app/models/__init__.py`
  - `CreditDB` import 이름 반영

---

## Phase 3: CRUD 재작성

- [x] **3-1** `backend/app/crud/crud_credit.py`
  - `assign_free_trial` → `start_trial(org_name, owner_user_id, member_user_ids)`
    - ORGANIZATION_TB 생성 (plan_id=trial, trial_started_at, trial_expires_at=+14일)
    - CREDIT_TB(organization_id) 생성 (credits=1, period_start=오늘, period_end=+14일)
    - USER_INFO_TB 전원 organization_id, org_role 업데이트
  - `start_subscription(org_name, plan_id, owner_user_id, member_user_ids)`
    - 기존 org 있으면 plan_id 업데이트 + subscription_end 설정
    - CREDIT_TB 생성 또는 리셋
  - `check_and_refresh(user_id)`
    - organization_id 없음 → no_subscription
    - plan_id=NULL + trial_expires_at 있음 → expired_trial
    - plan_id=NULL + trial_expires_at 없음 → expired_subscription
    - plan_id=trial → CREDIT_TB.credits_remaining 확인
    - plan_id=bronze/silver/gold → CREDIT_TB 확인
  - `decrement_credit(org_id, requested_by_user_id, base_id, history_id)`
    - CREDIT_TB.organization_id 기준 차감
    - USAGE_LOGS_TB 기록
  - `log_usage(org_id, requested_by_user_id, ...)`
  - `is_cached_for_user` 유지 (user_id 기준)

- [x] **3-2** `backend/app/crud/crud_invalidation_history.py`
  - `create_idea_history`: `user_id` → `requested_by_user_id`, `organization_id` 추가
  - `get_idea_history_list`: organization_id 기준 조회 + 개인 필터 지원
  - `get_idea_history_detail`, `delete_idea_history`: 변경 반영

---

## Phase 4: 스케줄러 재작성

- [x] **4-1** `backend/app/services/credit_scheduler.py`
  - Trial 만료: `plan_id=trial AND trial_expires_at <= 오늘` → `plan_id=NULL`, credits=0
  - 유료 월 리셋: `CREDIT_TB.period_end == 오늘`
    - `period_end == subscription_end` → 연간 만료: `plan_id=NULL`, credits=0
    - 아니면 → credits 리셋, period_start=오늘, period_end+=1개월

---

## Phase 5: 라우터 수정

- [x] **5-1** `backend/app/api/routers/invalidation_router.py`
  - `check_and_refresh` 반환 `org_id` 활용
  - `decrement_credit(org_id, requested_by_user_id=user_id, ...)` 호출
  - `log_usage(org_id, requested_by_user_id=user_id, ...)` 호출
  - history 조회: organization_id 기준
- [x] **5-2** `backend/app/api/routers/user_router.py`
  - `trial_started` 참조 없음 확인 (Phase 2에서 모델 삭제 시 이미 정리됨)

---

## Phase 6: 동작 확인

- [ ] **6-1** 서버 재시작 오류 없음
- [ ] **6-2** Trial 시작 → ORGANIZATION_TB, CREDIT_TB 정상 생성
- [ ] **6-3** 선행기술조사 요청 → CREDIT_TB 차감, USAGE_LOGS_TB 기록
- [ ] **6-4** Trial 만료 시뮬레이션 → plan_id=NULL, credits=0
- [ ] **6-5** 유료 구독 월별 리셋 시뮬레이션
- [ ] **6-6** 연간 만료 시뮬레이션
