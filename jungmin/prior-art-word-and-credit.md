# 선행기술조사 — 리팩토링 계획 & 추적 문서

> 상태 범례: ✅ 완료 / 🔧 진행 중 / ⬜ 미착수

---

## 1. Word 다운로드

### 방식
브라우저에서 `html-docx-js`로 직접 변환. 백엔드 호출 없음. ✅

### 흐름
```
[Word 저장 버튼 클릭]
  → handleWordExport() (page.tsx)
  → html-docx-js.asBlob(hidden div innerHTML)
  → .docx 파일 다운로드
```

### 관련 파일
| 파일 | 변경 내용 |
|------|-----------|
| `frontend/app/[locale]/prior-art/report/page.tsx` | Word 버튼 + handleWordExport() + hidden PrintContent div 추가 |
| `frontend/lib/invalidation_api.ts` | `invalExportDocx()` 함수 제거 |
| `frontend/types/html-docx-js.d.ts` | 신규 — html-docx-js 타입 선언 |
| `backend/app/api/routers/invalidation_router.py` | `/export/docx` 라우트 제거 |
| `backend/app/services/invalidation/docx_generator.py` | 삭제 |

---

## 2. DB 모델 정리

### 최종 유지 테이블 (2개)

| 테이블 | 역할 |
|--------|------|
| `INVAL_PREPARE_CACHE_TB` | raw_text → GPU prepare 결과 캐시 (base_id, prior_patents 15건) |
| `INVAL_IDEA_HISTORY_TB` | 조직별 조사 결과 기록 (result_json, prior_app_numbers 포함) |

### 제거 대상 테이블 (5개) ⬜

#### ❌ `INVAL_PRIOR_ART_REPORT_TB` (`InvalPriorArtReportDB`)
**제거 이유:**
- `INVAL_IDEA_HISTORY_TB.result_json`과 완전히 중복. 같은 내용을 두 테이블에 쓰는 구조
- 설계 의도는 "조직 간 공유 캐시"였지만, 다른 조직이 **같은 아이디어 텍스트 + 같은 top-5 선행특허**를 동시에 갖는 확률 ≈ 0
- 캐시 히트가 없으므로 쓰기만 있고 읽기 효과가 없음

**영향 범위:**
- `crud/crud_invalidation_history.py` line 10: import 제거
- `crud/crud_invalidation_history.py` line 149-158: 폴백 로직 제거 (구버전 호환용이었으나 result_json 없는 히스토리는 무효로 처리)
- `routers/invalidation_router.py`: stream 엔드포인트 ②공유캐시 블록 제거, pipeline 후 저장 제거
- `routers/invalidation_router.py`: `generate_prior_art_report` (non-stream) 엔드포인트 전체 제거

---

#### ❌ `INVAL_PAIR_ANALYSIS_TB` (`InvalPairAnalysisDB`)
**제거 이유:**
- 앵커(anchor)의 텍스트 해시 기준 캐시인데, **아이디어 텍스트가 조금이라도 바뀌면 앵커 텍스트도 바뀜** → 해시 미스
- 같은 아이디어를 완전히 동일하게 다시 올리는 경우(= prior_app_numbers 동일)는 stream 엔드포인트에서 이미 캐시 히트 처리 → pair analysis까지 안 도달
- 따라서 실제 캐시 히트가 발생하는 케이스 없음

**영향 범위:**
- `routers/invalidation_router.py`: stream 엔드포인트 ④ 쌍별 분석 캐시 조회/저장 제거
- `routers/invalidation_router.py`: refresh 엔드포인트 쌍별 분석 캐시 재활용 로직 제거

---

#### ❌ `INVAL_ELEMENT_TB` (`InvalElementDB`)
**제거 이유:**
- 설계 의도: 선행특허 구성요소 파싱 결과를 앵커(base_id) 기준으로 저장해 재활용
- 재활용 가능한 경우가 딱 하나 — **같은 아이디어 + refresh 시 top-5 일부 겹칠 때**
- 그러나 조직별 INVAL_IDEA_HISTORY_TB에서 result_json으로 이미 이전 결과를 갖고 있어 실질적 중첩
- 아이디어 기반 플로우에서 base_app_number = base_id(텍스트 해시)라 특허번호 기반과 다름
- 제거하고 refresh 시 always GPU re-parse로 단순화

**영향 범위:**
- `routers/invalidation_router.py`: stream 엔드포인트 `_make_parse_task` 내 InvalElementDB 조회 제거, `_save_elements` 호출 제거
- `routers/invalidation_router.py`: refresh 엔드포인트 `_load_elements_from_db`, `existing_in_new`/`truly_new` 분기 제거
- `routers/invalidation_router.py`: `GET /patents/{app_number}/elements` 엔드포인트 제거
- 헬퍼 함수 `_save_elements` 전체 제거

---

#### ❌ `INVAL_ANALYSIS_TB` (`InvalAnalysisDB`)
**제거 이유:**
- 특허 번호 입력 플로우 전용 (base_app_number = 실제 출원번호)
- 아이디어 조사 플로우에서 전혀 사용 안 함
- 해당 플로우 엔드포인트들도 모두 제거 예정

**영향 범위:**
- 아래 레거시 엔드포인트들 제거 시 함께 제거됨

---

#### ❌ `INVAL_OVERRIDE_TB` (`InvalOverrideDB`)
**제거 이유:**
- 사용자 수동 구성요소 편집 기능 → 기능 자체를 제거
- 특허 번호 입력 플로우 전용
- 현재 아무 UI도 이 기능을 호출하지 않음

**영향 범위:**
- 아래 레거시 엔드포인트들 제거 시 함께 제거됨

---

## 3. 제거 대상 엔드포인트 (레거시 특허번호 입력 플로우) ⬜

현재 frontend에서 전혀 호출하지 않는 엔드포인트들. 특허 번호를 직접 입력해서 무효화 분석하는 구 플로우.

| 엔드포인트 | 설명 | 이유 |
|-----------|------|------|
| `POST /analysis/prior-art-report` | non-stream 버전 | stream으로 대체됨, 중복 |
| `GET /analysis/status/{base_app_number}` | 특허 상태 확인 | 특허번호 플로우 |
| `POST /analysis/parse/base` | 기준특허 구성요소 파싱 | 특허번호 플로우 |
| `POST /analysis/parse/prior` | 선행발명 구성요소 파싱 | 특허번호 플로우 |
| `POST /analysis/run` | 무효 분석 실행 | 특허번호 플로우 |
| `GET /analysis/overrides` | 세션 오버라이드 조회 | 특허번호 플로우 |
| `GET /analysis/{base_app_number}` | 분석 결과 조회 | 특허번호 플로우 |
| `POST /analysis/{analysis_id}/interpretation` | AI 해석 생성 | 특허번호 플로우 |
| `POST /analysis/extract-from-claims` | 청구항 기반 구성요소 추출 | 특허번호 플로우 |
| `POST /analysis/add-element` | 구성요소 추가 | 특허번호 플로우 |
| `POST /analysis/override` | 오버라이드 저장 | 특허번호 플로우 |
| `GET /analysis/{base_app_number}/download` | 분석 결과 다운로드 | 특허번호 플로우 |
| `GET /patents/{app_number}/elements` | 구성요소 목록 조회 | InvalElementDB 삭제로 불필요 |

**유지 엔드포인트:**
- `POST /analysis/prepare-from-text` ✅
- `POST /analysis/prepare-from-pdf` ✅
- `POST /analysis/prior-art-report/stream` 🔧 내부 로직 수정 필요
- `GET /analysis/idea/history` ✅
- `GET /analysis/idea/history/{history_id}` ✅
- `DELETE /analysis/idea/history/{history_id}` ✅
- `POST /analysis/idea/history/{history_id}/refresh` 🔧 내부 로직 수정 필요
- `GET /patents/info/{app_number}` ✅
- `GET /patents/{app_number}/claims` ✅

---

## 4. 엔드포인트별 최종 로직

### ① `POST /analysis/prior-art-report/stream` 🔧

```
[진입]
  1. check_subscription(db, user_id)
     - expired_trial → yield sse(error, "expired_trial") return
     - expired_subscription → yield sse(error, "expired_subscription") return
     - ok → org_id, subscription_started_at 획득

  2. prior_app_numbers 비교 (재조회 감지)
     - INVAL_IDEA_HISTORY_TB에서 같은 org + base_id + status="success" 최신 1건 조회
       (subscription_started_at 이후 필터 적용)
     - 이전 기록의 prior_app_numbers == 현재 prior_app_numbers → 캐시 히트
       → log_usage("prior_art_search_cached")
       → yield sse({done: True, result: prev_history.result_json}) return
     - 다르면 → 새 검색으로 취급 (사용자가 새로운 결과를 기대하는 것)

  3. check_credits(db, org_id)
     - no_credits → log_usage, yield sse(error, "no_credits") return

  4. 앵커 추출 → GPU

  5. 선행발명 파싱 → GPU (DB 캐시 없음, 항상 fresh)
     as_completed로 스트리밍 진행률 표시

  6. 임베딩 + 유사도 계산 → GPU

  7. 쌍별 분석 → GPU (DB 캐시 없음, 항상 fresh)
     as_completed로 anchor_done 이벤트 스트리밍

  8. 종합 검토의견 → GPU

  9. 결과 저장
     - INVAL_IDEA_HISTORY_TB에 history 생성 (result_json 포함)
     - decrement_credit
     - yield sse({done: True, result})
```

**코드 수준 변경 목록:**
- `prior_hash` / `report_cache_key` 계산 제거 (line 551-552)
- `is_cached_for_user` 블록 → prior_app_numbers 비교로 교체 (line 571-585)
- 공유 캐시 읽기 블록 제거 (line 593-612)
- `_make_parse_task` 내 InvalElementDB 조회 블록 제거 (line 635-644)
- `_make_parse_task` 내 `_save_elements` 호출 제거 (line 656)
- 쌍별 분석 InvalPairAnalysisDB 조회/저장 제거 (line 744-780)
- 파이프라인 후 InvalPriorArtReportDB 저장 제거 (line 816-821)
- `create_idea_history` 호출: `report_cache_key` → `""` 전달

**교체 코드 (is_cached_for_user → prior_app_numbers 비교):**
```python
prev_q = select(InvalIdeaHistoryDB).where(
    InvalIdeaHistoryDB.organization_id == org_id,
    InvalIdeaHistoryDB.base_id == base_id,
    InvalIdeaHistoryDB.status == "success",
)
if subscription_started_at:
    prev_q = prev_q.where(InvalIdeaHistoryDB.created_at >= subscription_started_at)
prev_r = await db.execute(prev_q.order_by(InvalIdeaHistoryDB.created_at.desc()))
prev_history = prev_r.scalars().first()
if prev_history and prev_history.result_json:
    prev_prior = json.loads(prev_history.prior_app_numbers) if prev_history.prior_app_numbers else []
    if set(prev_prior) == set(prior_app_numbers):
        await log_usage(db, org_id, user_id, base_id, "prior_art_search_cached")
        yield sse({"done": True, "result": json.loads(prev_history.result_json)}); return
```

---

### ② `GET /analysis/idea/history` ✅

```
1. check_subscription(db, user_id)
   - ok가 아니면 [] 반환
   - subscription_started_at이 None이면 [] 반환

2. get_idea_history_list(db, org_id, user_id=filter_user_id,
                         subscription_started_at=subscription_started_at)
```

---

### ③ `GET /analysis/idea/history/{history_id}` ✅ (crud 수정 필요)

```
1. user_id → organization_id 조회
2. get_idea_history_detail(db, history_id, user_id, org_id=org_id)
   - 본인이거나 같은 조직이면 반환
   - 구독/크레딧 체크 없음 (목록이 이미 필터링했으므로)
```

---

### ④ `POST /analysis/idea/history/{history_id}/refresh` 🔧

```
1. check_credits(db, org_id)
   - no_credits → 402 반환
   (check_subscription 불필요: 스케줄러가 만료 시 credits=0으로 atomic 처리)

2. INVAL_IDEA_HISTORY_TB에서 history 조회

3. INVAL_PREPARE_CACHE_TB에서 raw_text, full_text 로드

4. GPU refresh: Neo4j 재검색 → new_prior_app_numbers

5. prior_app_numbers 변화 없으면
   → {changed: False, result: old_result} 반환 (크레딧 차감 없음)

6. 변화 있으면 파이프라인 재실행
   - 앵커: old_result.anchors 재활용 (LLM 생략)
   - 선행발명 파싱: GPU fresh (new_prior_app_numbers 전체, DB 캐시 없음)
   - 임베딩 + 유사도 + 쌍별 분석 + 종합 검토의견
   - update_idea_history_result
   - decrement_credit
   → {changed: True, result: new_result} 반환
```

**코드 수준 변경 목록:**
- `existing_in_new` / `truly_new` 분기 제거 (line 983-1005): 항상 GPU re-parse
- `_load_elements_from_db` 함수 제거 (line 987-999)
- `_parse_new_patent` 통합: 단순히 new_prior_app_numbers 전체 GPU 파싱
- InvalPairAnalysisDB 캐시 조회/저장 제거 (line 1147-1201)

---

## 5. 파일별 변경 상세

### `backend/app/models/invalidation.py` ⬜
- 제거: `InvalPriorArtReportDB`, `InvalPairAnalysisDB`, `InvalElementDB`, `InvalAnalysisDB`, `InvalOverrideDB`
- import에서 `Float` 제거 (InvalAnalysisDB만 사용하던 것)
- 유지: `InvalPrepareCacheDB`, `InvalIdeaHistoryDB`

### `backend/app/crud/crud_credit.py` 🔧
- 제거: `is_cached_for_user` 함수 (stream 엔드포인트 내 inline 비교로 대체)
- 제거: `InvalIdeaHistoryDB` import

### `backend/app/crud/crud_invalidation_history.py` ⬜
- 제거: `InvalPriorArtReportDB` import (line 10)
- 제거: `get_idea_history_detail` 내 InvalPriorArtReportDB 폴백 블록 (line 149-158)
- 변경: `create_idea_history`의 `report_cache_key` 파라미터 기본값 `""` 추가 (또는 제거)

### `backend/app/api/routers/invalidation_router.py` ⬜
- import 정리: 위에 나열한 것들 제거
- 엔드포인트 13개 제거
- 헬퍼 함수 5개 제거 (`_save_elements`, `_load_overrides`, `_apply_overrides`, `_run_greedy`, `_generate_interpretation`)
- stream 엔드포인트 내부 수정
- refresh 엔드포인트 내부 수정

---

## 6. 구독/크레딧 구조

### 핵심 함수

| 함수 | 역할 |
|------|------|
| `check_subscription(db, user_id)` | plan_id NULL 여부 확인 → ok/reason 반환 |
| `check_credits(db, org_id)` | credits_remaining == 0 여부 확인 |
| `decrement_credit(db, org_id, ...)` | 크레딧 1 atomic 차감 + 로그 |
| `log_usage(db, org_id, ...)` | 차감 없는 이벤트 로그 |

### 구독 상태 판단 로직
스케줄러가 만료 시 `plan_id = NULL` + `credits_remaining = 0`을 **동시에** 세팅.
→ check_credits 통과 = 구독 유효 보장 (refresh 엔드포인트에서 check_subscription 생략 근거)

### 프론트엔드 에러 코드 처리
```
no_credits           → "이번 달 이용 한도를 모두 사용했습니다"
expired_trial        → "무료 체험이 종료되었습니다"
expired_subscription → "이용 권한이 없습니다"
```

---

## 7. 아카이브

제거 대상 코드 전체는 `jungmin/legacy_patent_analysis_flow.py`에 보관.
특허번호 입력 플로우 복원이 필요하면 이 파일에서 가져올 것.
