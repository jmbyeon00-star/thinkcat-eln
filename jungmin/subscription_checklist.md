# 구독/크레딧 시스템 구현 체크리스트

> 상태: ⬜ 미완 / ✅ 완료
> 기준 설계서: `subscription_plan.md`

---

## Phase 1 — DB 마이그레이션 (SQL 직접 실행)

> MariaDB `thinkcateln` DB에 직접 실행. 순서 중요 (FK 의존성).

- ✅ **1-1** `USER_INFO_TB` 컬럼 추가
  ```sql
  ALTER TABLE USER_INFO_TB
    ADD COLUMN organization_id INT NULL,
    ADD COLUMN org_role ENUM('owner', 'member') NULL,
    ADD COLUMN trial_started BOOLEAN NOT NULL DEFAULT FALSE;
  ```

- ✅ **1-2** `ORGANIZATION_TB` 신규 생성
  ```sql
  CREATE TABLE ORGANIZATION_TB (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    owner_user_id INT NOT NULL,
    reset_at      DATETIME NOT NULL,
    period_end    DATETIME NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_org_owner FOREIGN KEY (owner_user_id) REFERENCES USER_INFO_TB(id)
  ) DEFAULT CHARSET=utf8mb4;
  ```

- ✅ **1-3** `USER_INFO_TB.organization_id` FK 연결
  ```sql
  ALTER TABLE USER_INFO_TB
    ADD CONSTRAINT fk_user_org
    FOREIGN KEY (organization_id) REFERENCES ORGANIZATION_TB(id)
    ON DELETE SET NULL;
  ```

- ✅ **1-4** `USER_CREDIT_TB` 신규 생성
  ```sql
  CREATE TABLE USER_CREDIT_TB (
    user_id           INT PRIMARY KEY,
    credits_remaining INT NOT NULL DEFAULT 0,
    credits_total     INT NOT NULL DEFAULT 0,
    valid_until       DATETIME NOT NULL,
    updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_credit_user FOREIGN KEY (user_id) REFERENCES USER_INFO_TB(id)
  ) DEFAULT CHARSET=utf8mb4;
  ```

- ✅ **1-5** `USAGE_LOGS_TB` 신규 생성
  ```sql
  CREATE TABLE USAGE_LOGS_TB (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    organization_id INT NULL,
    base_id         VARCHAR(120) NOT NULL,
    action          VARCHAR(50)  NOT NULL,
    reason          VARCHAR(50)  NULL,
    credits_used    INT NOT NULL DEFAULT 0,
    history_id      BIGINT NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usage_user_base (user_id, base_id),
    INDEX idx_usage_user_action (user_id, action),
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES USER_INFO_TB(id)
  ) DEFAULT CHARSET=utf8mb4;
  ```

- ✅ **1-6** `INVAL_IDEA_HISTORY_TB` 컬럼 추가
  ```sql
  ALTER TABLE INVAL_IDEA_HISTORY_TB
    ADD COLUMN status        VARCHAR(20) NOT NULL DEFAULT 'success',
    ADD COLUMN error_message TEXT NULL;
  ```

---

## Phase 2 — SQLAlchemy 모델

- ✅ **2-1** `backend/app/models/subscription.py` 신규 생성
  - `OrganizationDB` 클래스 (ORGANIZATION_TB)
  - `UserCreditDB` 클래스 (USER_CREDIT_TB)
  - `UsageLogDB` 클래스 (USAGE_LOGS_TB)

- ✅ **2-2** `backend/app/models/user.py` 수정
  - `organization_id`, `org_role`, `trial_started` 컬럼 추가

- ✅ **2-3** `backend/app/models/invalidation.py` 수정
  - `InvalIdeaHistoryDB`에 `status`, `error_message` 컬럼 추가

- ✅ **2-4** `backend/app/models/__init__.py` 수정
  - `subscription.py` 모델 import 추가

---

## Phase 3 — CRUD 함수 (`crud/crud_credit.py` 신규)

- ✅ **3-1** `assign_free_trial(db, user_id)` 구현
  - `trial_started=True` 이면 즉시 False 반환 (중복 방지)
  - `USER_CREDIT_TB`: credits=2, valid_until=+1개월
  - `USER_INFO_TB`: trial_started=True 업데이트

- ✅ **3-2** `start_subscription(db, org_id, user_ids)` 구현
  - `ORGANIZATION_TB`: reset_at=+1개월, period_end=계약 종료일
  - 각 user에 `USER_CREDIT_TB`: monthly_credits(팀원수) 지급, valid_until=reset_at
  - 각 user `USER_INFO_TB`: organization_id, org_role 업데이트

- ✅ **3-3** `check_and_refresh(db, user_id)` 구현
  - organization_id 있으면 → period_end 확인 → `('expired_subscription')`
  - organization_id 있으면 → reset_at 도달 시 크레딧 리셋 + reset_at += 1개월
  - valid_until 확인 → `('expired_trial')`
  - credits_remaining == 0 → `('no_credits')`
  - 반환: `(True, 'ok')` 또는 `(False, reason_string)`

- ✅ **3-4** `is_cached_for_user(db, user_id, base_id)` 구현
  - `USAGE_LOGS_TB`에서 user_id + base_id + action='prior_art_search' 조회
  - 히트 → True

- ✅ **3-5** `decrement_credit(db, user_id, base_id, history_id, org_id)` 구현
  - atomic: `UPDATE USER_CREDIT_TB SET credits_remaining -= 1 WHERE user_id=? AND credits_remaining > 0`
  - 단일 트랜잭션 내에서 `USAGE_LOGS_TB` insert (action='prior_art_search')
  - 업데이트 행 0 → False 반환

- ✅ **3-6** `log_usage(db, user_id, base_id, action, reason, history_id, org_id)` 구현
  - 차감 없는 이벤트 로그 insert
  - reason: 차단/실패 이벤트에만 적용

---

## Phase 4 — 라우터 수정

- ✅ **4-1** `invalidation_router.py` — stream 엔드포인트 크레딧 흐름 삽입
  - `event_stream()` 시작부에 `check_and_refresh` 호출
  - 각 실패 케이스별 `log_usage` + 적절한 error event 반환
  - `is_cached_for_user` 분기
  - GPU 실패 시 reason 분기 (gpu_timeout / gpu_error / invalid_input)
  - 성공 후 `decrement_credit` 호출

- ✅ **4-2** `user_router.py` — 무료 체험 시작 엔드포인트 추가
  - `POST /user/free-trial`
  - JWT에서 user_id 추출 → `assign_free_trial(db, user_id)` 호출
  - 이미 시작된 경우 409 반환

---

## Phase 5 — 연결 검증

- ✅ **5-1** 단위 테스트: `assign_free_trial` 중복 호출 방어 확인
- ✅ **5-2** 단위 테스트: `decrement_credit` 동시 요청 atomic 확인
- ✅ **5-3** 통합 테스트: 무료 체험 2회 소진 후 403 반환 확인
- ✅ **5-4** 통합 테스트: 동일 base_id 재조회 시 credits_remaining 불변 확인
- ⬜ **5-5** 통합 테스트: reset_at 도달 시 크레딧 리셋 확인

---

## 진행 현황

| Phase | 항목 수 | 완료 |
|-------|--------|------|
| 1. DB 마이그레이션 | 6 | 6 ✅ |
| 2. SQLAlchemy 모델 | 4 | 4 ✅ |
| 3. CRUD 함수 | 6 | 6 ✅ |
| 4. 라우터 수정 | 2 | 2 ✅ |
| 5. 연결 검증 | 5 | 0 |
| **합계** | **23** | **0** |
