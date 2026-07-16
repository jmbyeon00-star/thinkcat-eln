# 선행기술조사 Word 다운로드 구현 계획 (v2)

---

## 0. 질문 답변 먼저

### "온디맨드 방식인가?"
**맞음.** 유저가 "Word 다운로드" 버튼을 누르는 순간 서버가 그때 생성해서 바로 반환.
분석이 끝날 때 미리 만들어두지 않음. 버튼 → POST → blob → 다운로드.

### "⚠️ 경고가 내 코드 키가 잘못됐다는 건가?"
**아님.** 내 이전 plan 문서가 틀렸다는 경고였음.
프론트(report/page.tsx line 795, 801)와 백엔드(프롬프트 파일) 모두 `patentability_review`, `filing_strategy`를 이미 올바르게 쓰고 있음.
내가 plan에서 `idea_title`, `overall_opinion`, `strategy`라고 잘못 가정했던 거임. 기존 코드는 전혀 문제없음.

---


## 1. PDF 미리보기 구조 분석 (report/page.tsx `PrintContent`)

미리보기는 3섹션으로 구성되고, **두 개의 데이터 객체**를 씀:
- `prepareData: IdeaPrepareResult` — prepare 단계에서 나온 결과
- `report: PriorArtReportResult` — SSE done 이벤트로 받은 분석 결과

```
[커버]
  · 씽캣 · 선행기술조사보고서
  · prepareData.refined_title
  · 작성일 (오늘)

[아이디어 원본 텍스트]
  · prepareData.full_text

[Section 01] 유사 선행특허 (N건)
  · prepareData.prior_patents (similarity_score 내림차순 정렬)
  · 컬럼: #, 제목, 출원번호, 출원일, 유사도%

[Section 02] 구성요소별 유사도 분석
  · report.per_anchor_data  ← 각 앵커 루프
    - anchor_id, anchor_name, similarity_level (높음/보통/낮음)
    - report.report.anchor_analyses에서 anchor_id로 매핑해 prior_comparisons 사용
      - patent_title, patent_id
      - matched_element (대응 구성요소)
      - similarity (LLM 텍스트, 유사성)       ← pair-analysis 키
      - avoidance_direction (LLM 텍스트, 회피전략)  ← pair-analysis 키
    - report.uncovered_anchors에 포함된 앵커 → "차별화 가능 구성요소" 뱃지

[Section 03] 권리화 종합 전략
  · 최적 조합: per_anchor_data → 앵커별 top_priors[0] → 특허별 그룹화
  · report.report.overall.patentability_review  ← overall 실제 키
  · report.report.overall.filing_strategy       ← overall 실제 키
```

---

## 2. 실제 키 정리

### prepareData (IdeaPrepareResult)
```typescript
{
  idea_uuid:         string
  base_id:           string
  full_text:         string      // 아이디어 전체 텍스트 (정제)
  refined_title:     string      // 커버에 쓰는 제목
  raw_text:          string
  prior_patents: {               // Section 01 테이블용
    application_number: string
    title:              string
    filing_date:        string | null
    similarity_score:   number | null  // 유사도 % 계산용
    ...
  }[]
  prior_app_numbers: string[]
}
```

### report (PriorArtReportResult)
```typescript
{
  per_anchor_data: {             // Section 02 앵커 루프용
    anchor_id:        string     // "E1", "E2" ...
    anchor_name:      string
    similarity_level: "높음" | "보통" | "낮음"
    top_priors: {
      patent_id:  string
      title:      string
      similarity: number         // float (숫자) — 최적조합 계산용
      ...
    }[]
  }[]
  uncovered_anchors: string[]    // 차별화 가능 구성요소 이름 목록

  report: {
    anchor_analyses: {           // Section 02 LLM 결과용
      anchor_id:        string
      anchor_name:      string
      similarity_level: string
      prior_comparisons: {
        patent_id:           string
        patent_title:        string
        matched_element:     string
        operation:           string
        similarity:          string   // ← LLM 텍스트 (숫자 아님!)
        avoidance_direction: string   // ← LLM 텍스트
      }[]
    }[]
    overall: {
      patentability_review: string   // ← 특허성 종합 검토
      filing_strategy:      string   // ← 특허출원 전략
    }
  }
}
```

---

## 3. 변경 범위

### 추가할 것
```
backend/
├── requirements.txt                              ← python-docx 추가
└── app/
    ├── services/invalidation/
    │   └── docx_generator.py                     ← 신규 (PrintContent 구조 그대로)
    └── api/routers/invalidation_router.py        ← POST /export/docx 추가

frontend/
└── lib/
    └── invalidation_api.ts                       ← invalExportDocx() 함수 추가
```

---

## 4. 백엔드 구현

### 4-1. requirements.txt
```
python-docx     ← 맨 아래 한 줄 추가
```

---

### 4-2. docx_generator.py (신규)

PDF `PrintContent` 컴포넌트와 동일한 3섹션 구조.

```python
# backend/app/services/invalidation/docx_generator.py

import io
from datetime import date
from docx import Document
from docx.shared import Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH


_LEVEL_COLOR = {
    "높음": RGBColor(0xD8, 0x00, 0x00),
    "보통": RGBColor(0xE6, 0x7E, 0x22),
    "낮음": RGBColor(0x27, 0xAE, 0x60),
}


def build_docx(prepare_data: dict, report: dict) -> bytes:
    """
    prepare_data : IdeaPrepareResult (prepare 단계 결과)
    report       : PriorArtReportResult (SSE done 결과)
    """
    doc = Document()
    doc.styles["Normal"].font.name = "맑은 고딕"
    doc.styles["Normal"].font.size = Pt(10.5)

    refined_title   = prepare_data.get("refined_title") or "선행기술조사보고서"
    full_text       = prepare_data.get("full_text", "")
    prior_patents   = sorted(
        prepare_data.get("prior_patents", []),
        key=lambda p: -(p.get("similarity_score") or 0)
    )

    per_anchor_data   = report.get("per_anchor_data", [])
    uncovered_anchors = report.get("uncovered_anchors", [])
    anchor_analyses   = report.get("report", {}).get("anchor_analyses", [])
    overall           = report.get("report", {}).get("overall", {})

    # anchor_id → analysis 매핑
    analysis_map = {a["anchor_id"]: a for a in anchor_analyses}

    today = date.today().strftime("%Y년 %m월 %d일")

    # ── 커버 ──────────────────────────────────────────────
    sub = doc.add_paragraph()
    sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub.add_run("씽캣 · 선행기술조사보고서").font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = t.add_run(refined_title)
    r.font.size = Pt(20)
    r.font.bold = True

    d = doc.add_paragraph()
    d.alignment = WD_ALIGN_PARAGRAPH.CENTER
    d.add_run(f"작성일 {today}").font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)

    doc.add_page_break()

    # ── 아이디어 원본 텍스트 ───────────────────────────────
    doc.add_heading("아이디어 원본 텍스트", level=1)
    doc.add_paragraph(full_text)

    # ── Section 01: 유사 선행특허 ─────────────────────────
    doc.add_heading(f"Section 01  유사 선행특허 ({len(prior_patents)}건)", level=1)
    tbl = doc.add_table(rows=1, cols=5)
    tbl.style = "Light Grid Accent 1"
    hdr = tbl.rows[0].cells
    for i, h in enumerate(["#", "제목", "출원번호", "출원일", "유사도"]):
        hdr[i].text = h
        hdr[i].paragraphs[0].runs[0].bold = True

    for i, p in enumerate(prior_patents):
        score = p.get("similarity_score")
        score_str = f"{score * 100:.1f}%" if score is not None else "-"
        row = tbl.add_row().cells
        row[0].text = str(i + 1)
        row[1].text = p.get("title", "")
        row[2].text = p.get("application_number", "")
        row[3].text = p.get("filing_date") or "-"
        row[4].text = score_str
    doc.add_paragraph()

    # ── Section 02: 구성요소별 유사도 분석 ───────────────
    doc.add_heading("Section 02  구성요소별 유사도 분석", level=1)
    for anchor in per_anchor_data:
        anchor_id   = anchor.get("anchor_id", "")
        anchor_name = anchor.get("anchor_name", "")
        level       = anchor.get("similarity_level", "")
        analysis    = analysis_map.get(anchor_id, {})
        comparisons = analysis.get("prior_comparisons", [])

        # 앵커 헤더
        h = doc.add_paragraph()
        hr = h.add_run(f"{anchor_id} · {anchor_name}  ")
        hr.bold = True
        lr = h.add_run(level)
        lr.font.color.rgb = _LEVEL_COLOR.get(level, RGBColor(0, 0, 0))

        if comparisons:
            ctbl = doc.add_table(rows=1, cols=4)
            ctbl.style = "Light Grid Accent 1"
            ch = ctbl.rows[0].cells
            for i, h_txt in enumerate(["선행문헌", "대응 구성요소", "유사성", "회피 전략"]):
                ch[i].text = h_txt
                ch[i].paragraphs[0].runs[0].bold = True
            for c in comparisons:
                row = ctbl.add_row().cells
                row[0].text = c.get("patent_title", c.get("patent_id", ""))
                row[1].text = c.get("matched_element", "")
                row[2].text = c.get("similarity", "")            # LLM 텍스트
                row[3].text = c.get("avoidance_direction", "")   # LLM 텍스트

        if anchor_name in uncovered_anchors:
            p = doc.add_paragraph()
            p.add_run("차별화 가능 구성요소 — 유사 선행발명 없음").font.color.rgb = RGBColor(0x16, 0x65, 0x34)

        doc.add_paragraph()

    # ── Section 03: 권리화 종합 전략 ─────────────────────
    doc.add_heading("Section 03  권리화 종합 전략", level=1)

    # 최적 조합 계산 (PrintContent 로직 동일)
    anchor_best: dict[str, dict] = {}
    for anchor in per_anchor_data:
        if not anchor.get("top_priors"):
            continue
        best = max(anchor["top_priors"], key=lambda x: x.get("similarity", 0))
        anchor_best[anchor["anchor_id"]] = {
            "pid": best["patent_id"],
            "title": best.get("title", best["patent_id"]),
            "anchor_name": anchor["anchor_name"],
        }

    patent_order: list[str] = []
    patent_to_anchors: dict[str, list[str]] = {}
    patent_titles: dict[str, str] = {}
    for anchor in per_anchor_data:
        best = anchor_best.get(anchor["anchor_id"])
        if not best:
            continue
        pid = best["pid"]
        if pid not in patent_to_anchors:
            patent_order.append(pid)
            patent_to_anchors[pid] = []
            patent_titles[pid] = best["title"]
        patent_to_anchors[pid].append(anchor["anchor_name"])

    if patent_order:
        doc.add_heading("최적 조합", level=2)
        combo = " + ".join(patent_titles[pid][:20] for pid in patent_order)
        doc.add_paragraph(combo).runs[0].bold = True
        for pid in patent_order:
            doc.add_paragraph(
                f"{patent_titles[pid]}: " + ", ".join(patent_to_anchors[pid]),
                style="List Bullet"
            )
        doc.add_paragraph()

    if overall.get("patentability_review"):
        doc.add_heading("특허성 종합 검토", level=2)
        doc.add_paragraph(overall["patentability_review"])   # patentability_review

    if overall.get("filing_strategy"):
        doc.add_heading("특허출원 전략", level=2)
        doc.add_paragraph(overall["filing_strategy"])        # filing_strategy

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
```

---

### 4-3. invalidation_router.py — 엔드포인트 추가

상단 import에 추가:
```python
import asyncio
from app.services.invalidation.docx_generator import build_docx
```

라우터에 추가 (히스토리 엔드포인트 근처):
```python
# ─────────────────────────────────
# Word 다운로드 (온디맨드)
# ─────────────────────────────────

@router.post("/export/docx")
async def export_prior_art_docx(payload: dict):
    """
    body: { prepareData: IdeaPrepareResult, report: PriorArtReportResult }
    → docx blob 반환
    """
    prepare_data = payload.get("prepareData")
    report       = payload.get("report")
    if not prepare_data or not report:
        raise HTTPException(status_code=400, detail="prepareData, report 모두 필요")

    docx_bytes = await asyncio.to_thread(build_docx, prepare_data, report)

    filename = "선행기술조사보고서.docx"
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
```

---

## 5. 프론트엔드 구현

### 5-1. invalidation_api.ts — 함수 추가

```typescript
export async function invalExportDocx(
  prepareData: IdeaPrepareResult,
  report: PriorArtReportResult,
): Promise<void> {
  const res = await apiFetch(`${BASE}/export/docx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ prepareData, report }),
  });
  if (!res.ok) throw new Error("Word 파일 생성 실패");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "선행기술조사보고서.docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

### 5-2. report/page.tsx — 버튼 추가

```tsx
// 기존 "PDF 저장" 버튼 옆에 추가
{report && prepareData && (
  <button
    onClick={() => invalExportDocx(prepareData, report)}
    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-700 transition-all"
  >
    <Download size={13} />
    Word 저장
  </button>
)}
```

---

## 6. 작업 순서

- [ ] `requirements.txt` — `python-docx` 한 줄 추가
- [ ] `backend/app/services/invalidation/docx_generator.py` 신규 생성
- [ ] `invalidation_router.py` — import + `/export/docx` 엔드포인트 추가
- [ ] `frontend/lib/invalidation_api.ts` — `invalExportDocx()` 함수 추가
- [ ] `frontend/app/[locale]/prior-art/report/page.tsx` — "Word 저장" 버튼 추가

---

## 7. 주의사항

- POST body에 `prepareData`와 `report` 둘 다 필요. `report`만 보내면 `refined_title`, `prior_patents.similarity_score` 없음
- `prior_comparisons[].similarity`는 **float 아닌 LLM이 생성한 텍스트 문자열**임
- `asyncio.to_thread` 필수 — python-docx는 sync 전용
- `build_docx`에서 `cleanText()` 적용하려면 아래 로직 추가:
  ```python
  import re
  def _clean(text: str) -> str:
      text = re.sub(r'\(criticality\s*\d*\)', '', text, flags=re.IGNORECASE)
      text = text.replace("앵커", "구성요소")
      return re.sub(r'\s{2,}', ' ', text).strip()
  ```
  그리고 `patentability_review`, `filing_strategy` 출력 시 `_clean()` 적용