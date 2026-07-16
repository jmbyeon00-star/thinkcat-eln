# TODO - 2026-06-23

## 선행기술조사 스트리밍 UI

### 목표
로딩 중에도 사용자가 분석 진행을 인지할 수 있도록 스트리밍 UI 구현

### 작업 내용

#### 1. 유사 선행 특허 (Section 01)
- [ ] prepareData 로드 즉시 Section 1 표시 (loading 중에도)
- [ ] 특허 15건 인터벌 기반 순차 등장 애니메이션 (60ms 간격, 위로 주르륵)
- [ ] `loading` 가드 외부로 섹션 이동

#### 2. 구성요소 종합 검토 (Section 02)
- [ ] 백엔드: `anchor_done` SSE 이벤트 추가
  - 각 앵커의 pair 분석이 완료될 때마다 이벤트 발송
  - 캐시 히트 앵커는 즉시 이벤트 발송
- [ ] `invalGeneratePriorArtReportStream`에 `onEvent` 콜백 추가
- [ ] 로딩 중: 완료된 앵커 카드가 순차 등장 (slideUp 애니메이션)
- [ ] 완료 후: 전체 아코디언 뷰로 전환 (stagger 애니메이션)

#### 3. 권리화 종합 전략 (Section 03)
- [ ] report 완료 후 fadeIn 애니메이션으로 등장

### 파일 목록
- `backend/app/api/routers/invalidation_router.py` - anchor_done 이벤트 추가
- `frontend/lib/invalidation_api.ts` - onEvent 콜백 추가
- `frontend/app/[locale]/prior-art/report/page.tsx` - UI 전면 개편

### 애니메이션 스펙
```css
@keyframes slideUpFade {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```
- 특허 등장: 60ms 간격 인터벌
- 앵커 등장: anchor_done 이벤트 수신 즉시
- Section 3 등장: 완료 후 fadeIn 0.5s
