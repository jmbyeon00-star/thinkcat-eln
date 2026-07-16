# stream 엔드포인트 현재 구조 정리

> 파일: `backend/app/api/routers/invalidation_router.py`  
> 엔드포인트: `POST /api/invalidation/analysis/prior-art-report/stream`  
> 날짜: 2026-07-16

---

## 1. 호출 방식

- **요청 타입:** `application/json` (payload dict)
- **응답 타입:** `text/event-stream` (SSE, StreamingResponse)
- **인증:** JWT (쿠키/헤더, `get_jwt_identity(request)`)

### 요청 payload

```
{
  idea_uuid:         str   (사용 안 함, 수신만)
  base_id:           str   (없으면 서버에서 md5 계산)
  raw_text:          str   (필수)
  full_text:         str   (LLM 정제본, 앵커/종합 LLM에 사용)
  prior_app_numbers: list  (필수, 프론트에서 선택한 top-5 출원번호)
  model:             str   (기본값 "claude")
  idea_title:        str   (수신만, 내부 로직에 미사용)
}
```

### SSE 이벤트 종류

| 이벤트 키 | 형식 | 설명 |
|-----------|------|------|
| `text` | `{text: str}` | 진행 상태 메시지 |
| `anchor_done` | `{event, data: PriorArtAnchorAnalysis}` | 구성요소 1개 분석 완료 |
| `done` | `{done: true, result: {...}}` | 전체 완료 + 결과 |
| `error` | `{error: str, code?: str}` | 에러 |

---

## 2. 실행 흐름 (단계별)

```
요청 수신
  ↓
payload 파싱 (base_id, raw_text, full_text, prior_app_numbers, model, user_id)
  ↓
base_id 없으면: base_id = "txt_" + md5(raw_text)[:16]
  ↓
event_stream() 코루틴 시작 (StreamingResponse에 전달)
```

### ① 구독 확인 (`check_subscription`)

```python
sub_status = await check_subscription(db, user_id)
# 실패 시: SSE error {code: "expired_trial" | "expired_subscription"} → return
# 성공 시: org_id 획득
```

- `check_subscription`은 `User → OrganizationDB` 조회
- `plan_id is None` → 구독 없음 (expired_trial 또는 expired_subscription)
- 실패하면 `log_usage` 기록 후 즉시 return

### ② 크레딧 확인 (`check_credits`)

```python
cred_status = await check_credits(db, org_id)
# 실패 시: SSE error {code: "no_credits"} → return
```

- `CreditDB.credits_remaining == 0` → 실패
- **⚠️ 이 시점에서 캐시 체크가 없음** — 히스토리가 있어도 항상 크레딧 확인 후 파이프라인 실행

### ③ 앵커 추출 (GPU `/gpu/invalidation/parse/anchors`)

```python
anchor_res = await client.post(".../parse/anchors", json={
    "raw_text": raw_text,
    "full_text": full_text,
    "model": model,
})
anchors = anchor_res.json()  # [{id, name, embedding_text, criticality}, ...]
```

- timeout: 180초
- anchors 비어있으면 → `log_usage` + SSE error return
- 성공 시: `text` 이벤트로 앵커 이름 목록 전송

### ④ 선행발명별 구성요소 파싱 (GPU `/gpu/invalidation/parse/prior-search`, 병렬)

```python
for app_num in prior_app_numbers:   # 보통 5개
    # patent_parser.get_patent_info(app_num, db) → DB에서 특허정보 로드
    # patent_parser.get_claims([app_num]) → 청구항 텍스트 로드
    # GPU /parse/prior-search → [{id, name, embedding_text, criticality, source_claim, raw_text}]
```

- `asyncio.as_completed`로 병렬 실행
- 각 완료마다 `text: "선행발명 파싱 중... (N/5)"` 이벤트 전송
- 모두 실패하면 → `log_usage` + SSE error return
- 결과: `prior_elements_map = {app_num: [elements]}`

### ⑤ 배치 임베딩 + 코사인 유사도 (GPU `/gpu/embed`)

```python
all_texts = anchor_texts + prior_flat_texts   # 앵커 + 모든 선행발명 구성요소
embed_res = await client.post(".../embed", json={"texts": all_texts})
# 반환: {"embeddings": [[float, ...], ...]}
```

- L2 정규화 후 코사인 유사도 계산 (`anchor @ prior.T`)
- 각 앵커별 선행발명별 최대 유사도를 구해서 `per_anchor_data` 구성
- `THRESHOLD = 0.65`: 이 이상인 선행발명만 `related_patents`에 포함
- 유사도 3단계: `높음(≥0.80)`, `보통(≥0.65)`, `낮음(<0.65)`

결과 구조:
```python
per_anchor_data = [
    {
        anchor_id, anchor_name, anchor_text, criticality,
        similarity_level,
        top_priors: [  # 선행발명별 최고 유사 구성요소 (len = len(prior_app_numbers))
            {patent_id, title, similarity, similarity_level,
             best_element_name, best_element_text, best_element_raw_text, best_element_claim}
        ]
    }
]
```

### ⑥ 쌍별 분석 (GPU `/gpu/invalidation/pair-analysis`, 병렬)

- 입력: `(앵커 × 선행발명)` 쌍, 보통 `5앵커 × 5선행 = 최대 25쌍`
- `asyncio.as_completed`로 병렬 실행
- 각 쌍 완료 후: 해당 앵커의 모든 쌍이 완료되면 → `anchor_done` SSE 이벤트 즉시 전송
- pair_cache에 `(anchor_text_hash, element_text_hash) → {similarity, avoidance_direction}` 저장

```python
# anchor_done 이벤트 구조:
{
    "event": "anchor_done",
    "data": {
        anchor_id, anchor_name, similarity_level,
        prior_comparisons: [
            {patent_id, patent_title, matched_element,
             operation, similarity, avoidance_direction}
        ]
    }
}
```

### ⑦ anchor_analyses 조립

- pair_cache 결과를 모아서 최종 `anchor_analyses` 리스트 구성
- ⑥의 `anchor_done` 이벤트 내용과 동일한 구조

### ⑧ 종합 검토의견 LLM (GPU `/gpu/invalidation/overall-synthesis`)

```python
overall_res = await client.post(".../overall-synthesis", json={
    "idea_full_text": full_text,
    "anchors": [...],
    "per_anchor_data": anchor_analyses,
    "related_patents": related_patents_list,
    "uncovered_anchors": uncovered_anchors,
    "model": model,
})
```

- timeout: 180초
- 실패 시: `log_usage` + SSE error return

### ⑨ 히스토리 저장 + 크레딧 차감 + done 이벤트

```python
result = {
    base_id, full_text, anchors, prior_infos,
    per_anchor_data, related_patents, uncovered_anchors,
    report: {
        anchor_analyses: [...],
        overall: overall_res.json(),
    }
}

history_id = await create_history(db, user_id, org_id, base_id, model, prior_app_numbers, result_json)
await decrement_credit(db, org_id, user_id, base_id, history_id)

yield sse({"done": True, "result": result})
```

- `create_history`: `INVAL_HISTORY_TB`에 INSERT
- `decrement_credit`: `CREDIT_TB.credits_remaining - 1` + `USAGE_LOG_TB` INSERT

---

## 3. 에러 처리

| 상황 | 처리 |
|------|------|
| `asyncio.TimeoutError` | `log_usage(reason="gpu_timeout")` + SSE error |
| 그 외 Exception | `traceback.print_exc()` + `log_usage(reason="gpu_error")` + SSE error |
| 구독 만료 | `log_usage` + SSE error + return |
| 크레딧 없음 | `log_usage` + SSE error + return |
| 앵커 없음 | `log_usage(reason="invalid_input")` + SSE error + return |
| 선행발명 파싱 전부 실패 | `log_usage` + SSE error + return |
| 종합 LLM 실패 | `log_usage(reason="gpu_error")` + SSE error + return |

---

## 4. 현재 구조의 문제점

### 히스토리 캐시 체크 없음 (핵심 버그)

현재 stream 엔드포인트는 **항상 전체 파이프라인을 실행**한다.

같은 `base_id`와 같은 `prior_app_numbers`로 이미 분석한 결과가 `INVAL_HISTORY_TB`에 있어도:
1. `check_credits` 실행 (크레딧 차감 예비 확인)
2. GPU /parse/anchors 호출
3. GPU /parse/prior-search 5번 호출
4. GPU /embed 호출
5. GPU /pair-analysis 최대 25번 호출
6. GPU /overall-synthesis 호출
7. `create_history` (중복 INSERT)
8. `decrement_credit` (크레딧 이중 차감)

### 추가되어야 하는 로직

```python
# ② 크레딧 확인 이후, ③ 앵커 추출 이전에 삽입:

existing = await get_org_history(db, org_id, base_id)
if existing and existing.result_json:
    old_prior = json.loads(existing.prior_app_numbers) if existing.prior_app_numbers else []
    if set(prior_app_numbers) == set(old_prior):
        # top-5 동일 → 캐시 반환 (크레딧 차감 없음)
        await log_usage(db, org_id, user_id, base_id, "prior_art_search_cached")
        yield sse({"done": True, "result": json.loads(existing.result_json)})
        return
    # top-5 다름 → 아래 파이프라인 계속 실행
```

---

## 5. 관련 함수 위치

| 함수 | 파일 | 역할 |
|------|------|------|
| `check_subscription` | `crud/crud_credit.py:16` | 구독 유효 여부 |
| `check_credits` | `crud/crud_credit.py:41` | 크레딧 잔여 여부 |
| `decrement_credit` | `crud/crud_credit.py:57` | 크레딧 1 차감 + 로그 |
| `log_usage` | `crud/crud_credit.py:95` | 차감 없는 이벤트 로그 |
| `create_history` | `crud/crud_invalidation_history.py:54` | 히스토리 INSERT |
| `get_org_history` | `crud/crud_invalidation_history.py:199` | org+base_id 최신 히스토리 조회 |
| `patent_parser.get_patent_info` | `services/invalidation/patent_parser.py` | 특허 메타정보 DB 조회 |
| `patent_parser.get_claims` | `services/invalidation/patent_parser.py` | 청구항 텍스트 조회 |
