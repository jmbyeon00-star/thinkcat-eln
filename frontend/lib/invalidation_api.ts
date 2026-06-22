/**
 * 특허 무효화 분석 API 클라이언트
 * /api/invalidation/* 엔드포인트 호출
 */
import { apiFetch } from "./apiFetch";
import { API_BASE } from "./api";

// 절대 URL(backend 직접). 상대경로면 Next rewrites 프록시를 거치는데,
// Next14 rewrites는 proxyTimeout 미적용(~30s)이라 선행기술조사(최대 60s+)가 끊김(socket hang up).
// 개발=backend 직접(8102), 운영=https://patents.thinkcat.kr(Apache가 /api 프록시, 타임아웃 길게).
const BASE = `${API_BASE}/api/invalidation`;

// ─────────────────────────────────
// 타입 정의
// ─────────────────────────────────

export interface InvalPatentSearchResult {
  application_number: string;
  title: string;
  filing_date: string | null;
  applicant_name: string | null;
  inventor_name: string | null;
  ipc_code: string | null;
  abstract: string | null;
  end_status: string | null;
  similarity_score: number | null;
}

export interface InvalElementResponse {
  id: number;
  application_number: string;
  base_app_number: string;
  element_key: string | null;
  name: string;
  function: string | null;
  modifier: string | null;
  embedding_text: string | null;
  criticality: number | null;
  criticality_reason: string | null;
  source_claim: string | null;
  raw_text: string | null;
  base_element_id: string | null;
  correspondence: string | null;
}

export interface IdeaPrepareResult {
  idea_uuid: string;
  base_id: string;
  full_text: string;
  refined_title: string;
  raw_text: string;
  prior_patents: InvalPatentSearchResult[];
  prior_app_numbers: string[];
}

// ─────────────────────────────────
// 선행기술조사보고서
// ─────────────────────────────────

export interface PriorArtPriorComparison {
  patent_id: string;
  patent_title: string;
  matched_element: string;
  operation: string;
  similarity: string;
  avoidance_direction: string;
}

export interface PriorArtAnchorAnalysis {
  anchor_id: string;
  anchor_name: string;
  similarity_level: "높음" | "보통" | "낮음";
  prior_comparisons: PriorArtPriorComparison[];
}

export interface PriorArtReportResult {
  idea_uuid: string;
  base_id: string;
  full_text: string;
  anchors: { id: string; name: string; embedding_text: string; criticality: number }[];
  prior_infos: Record<string, InvalPatentSearchResult>;
  per_anchor_data: {
    anchor_id: string;
    anchor_name: string;
    criticality: number;
    similarity_level: "높음" | "보통" | "낮음";
    top_priors: {
      patent_id: string;
      title: string;
      similarity: number;
      similarity_level: "높음" | "보통" | "낮음";
      best_element_name: string;
      best_element_text: string;
      best_element_claim: string | null;
    }[];
  }[];
  related_patents: { patent_id: string; title: string }[];
  uncovered_anchors: string[];
  report: {
    anchor_analyses: PriorArtAnchorAnalysis[];
    overall: {
      patentability_review: string;
      filing_strategy: string;
    };
  };
}

export async function invalGeneratePriorArtReport({
  idea_uuid,
  base_id,
  raw_text,
  full_text,
  prior_app_numbers,
  idea_title = "",
  model = "claude",
  token,
}: {
  idea_uuid: string;
  base_id: string;
  raw_text: string;
  full_text: string;
  prior_app_numbers: string[];
  idea_title?: string;
  model?: string;
  token?: string;
}): Promise<PriorArtReportResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await apiFetch(`${BASE}/analysis/prior-art-report`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ idea_uuid, base_id, raw_text, full_text, prior_app_numbers, idea_title, model }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "선행기술조사보고서 생성 실패");
    throw new Error(detail);
  }
  return res.json();
}

// ─────────────────────────────────
// 선행기술조사 히스토리
// ─────────────────────────────────

export interface IdeaHistoryItem {
  id: number;
  idea_title: string;
  idea_summary: string;
  prior_app_numbers: string[];
  model: string;
  created_at: string | null;
}

export interface IdeaHistoryDetail extends IdeaHistoryItem {
  report: PriorArtReportResult | null;
  prior_patents: InvalPatentSearchResult[];
}

export async function invalGetIdeaHistoryList(
  token: string,
  skip = 0,
  limit = 20,
): Promise<IdeaHistoryItem[]> {
  const res = await apiFetch(`${BASE}/analysis/idea/history?skip=${skip}&limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) return [];
  return res.json();
}

export async function invalGetIdeaHistoryDetail(
  token: string,
  historyId: number,
): Promise<IdeaHistoryDetail> {
  const res = await apiFetch(`${BASE}/analysis/idea/history/${historyId}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error("히스토리를 불러올 수 없습니다");
  return res.json();
}

export async function invalDeleteIdeaHistory(
  token: string,
  historyId: number,
): Promise<void> {
  const res = await apiFetch(`${BASE}/analysis/idea/history/${historyId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error("삭제 실패");
}

export async function invalRefreshIdeaHistory(
  token: string,
  historyId: number,
): Promise<{ changed: boolean; result: PriorArtReportResult | null }> {
  const res = await apiFetch(`${BASE}/analysis/idea/history/${historyId}/refresh`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) throw new Error("재생성 실패");
  return res.json();
}

export async function invalPrepareFromText(text: string, section: string = "ALL", n: number = 15): Promise<IdeaPrepareResult> {
  const res = await apiFetch(`${BASE}/analysis/prepare-from-text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ text, section, n }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "선행발명 검색 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalPrepareFromPdf(file: File, section: string = "ALL", n: number = 15): Promise<IdeaPrepareResult> {
  const formData = new FormData();
  formData.append("file", file);
  const params = new URLSearchParams({ section, n: String(n) });
  const res = await apiFetch(`${BASE}/analysis/prepare-from-pdf?${params}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "선행발명 검색 실패");
    throw new Error(detail);
  }
  return res.json();
}

export interface InvalParseResponse {
  base_app_number: string;
  base_elements: InvalElementResponse[];
  prior_elements: { [appNumber: string]: InvalElementResponse[] };
  prior_app_numbers: string[];
}

export interface InvalParseBaseResponse {
  base_app_number: string;
  base_elements: InvalElementResponse[];
  prior_app_numbers: string[];
}

export interface InvalParsePriorResponse {
  prior_app_number: string;
  elements: InvalElementResponse[];
}

export interface InvalElementUpdateRequest {
  name?: string;
  function?: string;
  modifier?: string;
  embedding_text?: string;
  criticality?: number;
  criticality_reason?: string;
  source_claim?: string;
  raw_text?: string;
}

export interface InvalAnalysisStatusResult {
  cached: boolean;
  unavailable: boolean;
  base: InvalPatentSearchResult | null;
  priors: InvalPatentSearchResult[];
}

export interface InvalAnalysisResponse {
  id: string;
  base_app_number: string;
  prior_app_numbers: string | null;
  coverage: number | null;
  result_json: string | null;
  interpretation: string | null;
  created_at: string | null;
}

// ─────────────────────────────────
// 특허 검색
// ─────────────────────────────────

export interface ClaimItem {
  claim_num: number;
  is_independent: boolean;
  text: string;
}

export async function invalGetClaims(appNumber: string): Promise<ClaimItem[]> {
  const res = await apiFetch(`${BASE}/patents/${encodeURIComponent(appNumber)}/claims`, { credentials: "include" });
  if (!res.ok) throw new Error("청구항 조회 실패");
  return res.json();
}

export async function invalExtractFromClaims({
  base_app_number,
  selected_claim_nums,
  existing_elements,
  model = "claude",
}: {
  base_app_number: string;
  selected_claim_nums: number[];
  existing_elements: { name: string; function: string | null }[];
  model?: string;
}): Promise<{ id: string; name: string; function: string; embedding_text: string; modifier: string | null; criticality: number; criticality_reason: string; source_claim: string; raw_text: string }[]> {
  const res = await apiFetch(`${BASE}/analysis/extract-from-claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ base_app_number, selected_claim_nums, existing_elements, model }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "추출 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalAddElement(payload: {
  base_app_number: string;
  application_number?: string;
  session_id: string;
  model: string;
  name: string;
  function?: string;
  modifier?: string;
  embedding_text?: string;
  criticality?: number;
  criticality_reason?: string;
  source_claim?: string;
  raw_text?: string;
}): Promise<InvalElementResponse> {
  const res = await apiFetch(`${BASE}/analysis/add-element`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "저장 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalGetPatentInfo(appNumber: string): Promise<InvalPatentSearchResult> {
  const res = await apiFetch(`${BASE}/patents/info/${encodeURIComponent(appNumber)}`, { credentials: "include" });
  if (!res.ok) throw new Error("특허 정보 조회 실패");
  return res.json();
}

export async function invalGetElements(
  appNumber: string,
  baseAppNumber: string,
  model: string = "claude",
  sessionId: string = "",
): Promise<InvalElementResponse[]> {
  const params = new URLSearchParams({ base_app_number: baseAppNumber, model });
  if (sessionId) params.set("session_id", sessionId);
  const res = await apiFetch(
    `${BASE}/patents/${encodeURIComponent(appNumber)}/elements?${params}`,
    { credentials: "include" },
  );
  if (!res.ok) throw new Error("구성요소 조회 실패");
  return res.json();
}

// ─────────────────────────────────
// 분석 상태 / 파싱 / 실행
// ─────────────────────────────────

export async function invalGetAnalysisStatus(appNumber: string, model: string = "claude"): Promise<InvalAnalysisStatusResult> {
  const res = await apiFetch(`${BASE}/analysis/status/${encodeURIComponent(appNumber)}?model=${encodeURIComponent(model)}`, { credentials: "include" });
  if (!res.ok) throw new Error("상태 확인 실패");
  return res.json();
}

export async function invalParseBase(
  baseAppNumber: string,
  skipCache: boolean = false,
  model: string = "claude",
): Promise<InvalParseBaseResponse> {
  const res = await apiFetch(`${BASE}/analysis/parse/base`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ base_app_number: baseAppNumber, skip_cache: skipCache, model }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "기준특허 파싱 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalParsePriorOne(
  baseAppNumber: string,
  priorAppNumber: string,
  skipCache: boolean = false,
  model: string = "claude",
): Promise<InvalParsePriorResponse> {
  const res = await apiFetch(`${BASE}/analysis/parse/prior`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ base_app_number: baseAppNumber, prior_app_number: priorAppNumber, skip_cache: skipCache, model }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "선행발명 파싱 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalRunAnalysis(
  baseAppNumber: string,
  skipCache: boolean = false,
  sessionId?: string,
  skipInterpretation: boolean = true,
  model: string = "claude",
): Promise<InvalAnalysisResponse> {
  const res = await apiFetch(`${BASE}/analysis/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      base_app_number: baseAppNumber,
      skip_cache: skipCache,
      session_id: sessionId ?? null,
      skip_interpretation: skipInterpretation,
      model,
    }),
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "분석 실행 실패");
    throw new Error(detail);
  }
  return res.json();
}

export async function invalGetAnalysis(baseAppNumber: string): Promise<InvalAnalysisResponse> {
  const res = await apiFetch(`${BASE}/analysis/${encodeURIComponent(baseAppNumber)}`, { credentials: "include" });
  if (!res.ok) throw new Error("분석 결과 조회 실패");
  return res.json();
}

export async function invalGenerateInterpretation(analysisId: string, model: string = "claude"): Promise<string> {
  const res = await apiFetch(`${BASE}/analysis/${encodeURIComponent(analysisId)}/interpretation?model=${encodeURIComponent(model)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const detail = await res.json().then(d => d.detail).catch(() => "해석 생성 실패");
    throw new Error(detail);
  }
  const data = await res.json();
  return data.interpretation;
}

// ─────────────────────────────────
// 오버라이드
// ─────────────────────────────────

export async function invalSaveOverride(
  sessionId: string,
  elementId: number,
  baseAppNumber: string,
  overrides: InvalElementUpdateRequest,
  model: string = "claude",
): Promise<void> {
  const res = await apiFetch(`${BASE}/analysis/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ session_id: sessionId, element_id: elementId, base_app_number: baseAppNumber, model, ...overrides }),
  });
  if (!res.ok) throw new Error("오버라이드 저장 실패");
}

export async function invalGetSessionOverrides(
  sessionId: string,
  baseAppNumber: string,
  model: string = "claude",
): Promise<{ [elementId: string]: Partial<InvalElementResponse> }> {
  const res = await apiFetch(
    `${BASE}/analysis/overrides?session_id=${encodeURIComponent(sessionId)}&base_app_number=${encodeURIComponent(baseAppNumber)}&model=${encodeURIComponent(model)}`,
    { credentials: "include" },
  );
  if (!res.ok) return {};
  return res.json();
}

// ─────────────────────────────────
// 다운로드
// ─────────────────────────────────

export async function invalDownloadAnalysis(baseAppNumber: string, sessionId?: string): Promise<void> {
  const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : "";
  const res = await apiFetch(`${BASE}/analysis/${encodeURIComponent(baseAppNumber)}/download${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("다운로드 실패");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analysis_${baseAppNumber}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
