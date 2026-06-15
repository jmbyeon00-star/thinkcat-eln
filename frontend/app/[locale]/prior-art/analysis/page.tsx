'use client';

import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import { useSearchParams } from "next/navigation";
import {
  invalRunAnalysis,
  invalGetPatentInfo,
  invalGetElements,
  invalSaveOverride,
  invalDownloadAnalysis,
  invalParseBase,
  invalParsePriorOne,
  invalGenerateInterpretation,
  invalGetClaims,
  invalExtractFromClaims,
  invalAddElement,
  InvalPatentSearchResult,
  InvalElementResponse,
  InvalAnalysisResponse,
  InvalParseResponse,
  InvalElementUpdateRequest,
  ClaimItem,
} from "@/lib/invalidation_api";

function cellBg(v: number) {
  if (v >= 0.85) return "#dc2626";
  if (v >= 0.75) return "#d97706";
  return "#e2e8f0";
}
function cellText(v: number) {
  if (v >= 0.75) return "#fff";
  return "#64748b";
}
function barBg(v: number) {
  if (v >= 0.85) return "#dc2626";
  if (v >= 0.75) return "#d97706";
  return "#60a5fa";
}

type Phase = "parsing" | "review" | "analyzing" | "done";

export default function InvalidationAnalysis() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const baseAppNumber = searchParams.get("base") ?? "";
  const cachedParam = searchParams.get("cached") === "true";
  const phaseParam = searchParams.get("phase") ?? undefined;
  const model = searchParams.get("model") || "claude";

  const [baseInfo, setBaseInfo] = useState<InvalPatentSearchResult | null>(null);
  const [priorInfoMap, setPriorInfoMap] = useState<{ [key: string]: InvalPatentSearchResult }>({});
  const [error, setError] = useState<string | null>(null);

  const [sessionId] = useState<string>(() =>
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );

  const [phase, setPhase] = useState<Phase>("parsing");

  const [parseData, setParseData] = useState<InvalParseResponse | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<InvalElementUpdateRequest>({});
  const [savingId, setSavingId] = useState<number | null>(null);
  const [overriddenIds, setOverriddenIds] = useState<Set<number>>(new Set());
  const [reviewStep, setReviewStep] = useState(0);
  const [priorLoadingNums, setPriorLoadingNums] = useState<Set<string>>(new Set());

  const [baseElements, setBaseElements] = useState<InvalElementResponse[]>([]);
  const [result, setResult] = useState<InvalAnalysisResponse | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [showInterp, setShowInterp] = useState(false);
  const [interpLoading, setInterpLoading] = useState(false);

  // 구성요소 추가 패널
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [selectedClaimNums, setSelectedClaimNums] = useState<number[]>([]);
  const [addMode, setAddMode] = useState<"manual" | "llm">("manual");
  const [extractingModel, setExtractingModel] = useState<"claude" | "ollama" | null>(null);
  const [addForm, setAddForm] = useState<{
    name: string; function: string; modifier: string;
    embedding_text: string; criticality: number; criticality_reason: string;
    source_claim: string; raw_text: string;
  }>({ name: "", function: "", modifier: "", embedding_text: "", criticality: 3, criticality_reason: "", source_claim: "", raw_text: "" });
  const [addSaving, setAddSaving] = useState(false);
  const [claimInput, setClaimInput] = useState("");
  const [addPanelAppNumber, setAddPanelAppNumber] = useState("");
  const [showClaimsModal, setShowClaimsModal] = useState(false);
  const [modalClaims, setModalClaims] = useState<ClaimItem[]>([]);
  const [modalClaimsLoading, setModalClaimsLoading] = useState(false);

  useEffect(() => {
    if (!baseAppNumber) return;

    invalGetPatentInfo(baseAppNumber).then(setBaseInfo).catch(console.error);

    const ssParseKey = `parse_${baseAppNumber}_${model}`;
    const ssResultKey = `result_${baseAppNumber}_${model}`;

    if (!cachedParam && typeof window !== "undefined") {
      sessionStorage.removeItem(ssParseKey);
      sessionStorage.removeItem(ssResultKey);
    }

    const ssData = typeof window !== "undefined" ? sessionStorage.getItem(ssParseKey) : null;
    const ssResult = typeof window !== "undefined" ? sessionStorage.getItem(ssResultKey) : null;

    if (ssResult && phaseParam === "done") {
      try {
        const resultData: InvalAnalysisResponse = JSON.parse(ssResult);
        setResult(resultData);
        if (resultData.result_json) {
          setParsed(JSON.parse(resultData.result_json));
          invalGetElements(baseAppNumber, baseAppNumber, model).then(setBaseElements).catch(console.error);
          const priorNums: string[] = JSON.parse(resultData.prior_app_numbers || "[]");
          priorNums.forEach(num => {
            invalGetPatentInfo(num).then(info => setPriorInfoMap(prev => ({ ...prev, [num]: info }))).catch(console.error);
          });
        }
        if (ssData) { try { setParseData(JSON.parse(ssData)); } catch { } }
        setPhase("done");
        if (resultData.interpretation) {
          setShowInterp(true);
        } else if (sessionStorage.getItem(`interp_pending_${resultData.id}`)) {
          setInterpLoading(true);
          setShowInterp(true);
          invalGenerateInterpretation(resultData.id, model)
            .then(interp => {
              sessionStorage.removeItem(`interp_pending_${resultData.id}`);
              const updated = { ...resultData, interpretation: interp };
              setResult(updated);
              if (typeof window !== "undefined") sessionStorage.setItem(`result_${baseAppNumber}_${model}`, JSON.stringify(updated));
            })
            .catch(e => console.error("해석 재요청 실패:", e))
            .finally(() => setInterpLoading(false));
        }
        return;
      } catch { }
    }

    const skipCache = !cachedParam;

    if (ssData) {
      try {
        const data: InvalParseResponse = JSON.parse(ssData);
        if (data.prior_app_numbers.length === 0) throw new Error("empty priors");
        setParseData(data);
        data.prior_app_numbers.forEach(num => {
          invalGetPatentInfo(num).then(info => setPriorInfoMap(prev => ({ ...prev, [num]: info }))).catch(console.error);
        });
        setPhase("review");

        const missing = data.prior_app_numbers.filter(n => !data.prior_elements[n]);
        if (missing.length > 0) {
          (async () => {
            for (const priorNum of missing) {
              setPriorLoadingNums(prev => new Set(prev).add(priorNum));
              try {
                const priorData = await invalParsePriorOne(baseAppNumber, priorNum, skipCache, model);
                setParseData(prev => {
                  if (!prev) return prev;
                  const updated: InvalParseResponse = {
                    ...prev,
                    prior_elements: { ...prev.prior_elements, [priorNum]: priorData.elements },
                  };
                  if (typeof window !== "undefined") sessionStorage.setItem(ssParseKey, JSON.stringify(updated));
                  return updated;
                });
              } catch (e) {
                console.error(`선행발명 파싱 실패 ${priorNum}:`, e);
              } finally {
                setPriorLoadingNums(prev => { const s = new Set(prev); s.delete(priorNum); return s; });
              }
            }
          })();
        }
        return;
      } catch { }
    }

    invalParseBase(baseAppNumber, skipCache, model)
      .then(baseData => {
        const initialData: InvalParseResponse = {
          base_app_number: baseData.base_app_number,
          base_elements: baseData.base_elements,
          prior_elements: {},
          prior_app_numbers: baseData.prior_app_numbers,
        };
        setParseData(initialData);
        setPhase("review");
        if (typeof window !== "undefined") sessionStorage.setItem(ssParseKey, JSON.stringify(initialData));

        baseData.prior_app_numbers.forEach(num => {
          invalGetPatentInfo(num).then(info => setPriorInfoMap(prev => ({ ...prev, [num]: info }))).catch(console.error);
        });

        (async () => {
          for (const priorNum of baseData.prior_app_numbers) {
            setPriorLoadingNums(prev => new Set(prev).add(priorNum));
            try {
              const priorData = await invalParsePriorOne(baseAppNumber, priorNum, skipCache, model);
              setParseData(prev => {
                if (!prev) return prev;
                const updated: InvalParseResponse = {
                  ...prev,
                  prior_elements: { ...prev.prior_elements, [priorNum]: priorData.elements },
                };
                if (typeof window !== "undefined") sessionStorage.setItem(ssParseKey, JSON.stringify(updated));
                return updated;
              });
            } catch (e) {
              console.error(`선행발명 파싱 실패 ${priorNum}:`, e);
            } finally {
              setPriorLoadingNums(prev => { const s = new Set(prev); s.delete(priorNum); return s; });
            }
          }
        })();
      })
      .catch(e => {
        setError(e.message);
        setPhase("review");
      });
  }, [baseAppNumber]);

  const [modalClaimsApp, setModalClaimsApp] = useState<string>("");

  const handleOpenClaimsModal = async (appNumber: string) => {
    setShowClaimsModal(true);
    if (modalClaimsApp === appNumber) return;
    setModalClaimsApp(appNumber);
    setModalClaims([]);
    setModalClaimsLoading(true);
    try {
      const data = await invalGetClaims(appNumber);
      setModalClaims([...data].sort((a, b) => a.claim_num - b.claim_num));
    } catch (e) { console.error(e); }
    finally { setModalClaimsLoading(false); }
  };

  const handleOpenAddPanel = async (appNumber: string) => {
    setShowAddPanel(true);
    setSelectedClaimNums([]);
    setClaimInput("");
    setAddPanelAppNumber(appNumber);
    setAddForm({ name: "", function: "", modifier: "", embedding_text: "", criticality: 3, criticality_reason: "", source_claim: "", raw_text: "" });
    setClaimsLoading(true);
    setClaims([]);
    try {
      const data = await invalGetClaims(appNumber);
      setClaims([...data].sort((a, b) => a.claim_num - b.claim_num));
    } catch (e) { console.error(e); }
    finally { setClaimsLoading(false); }
  };

  const toggleClaim = (num: number) => {
    setSelectedClaimNums(prev => {
      const next = prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num].sort((a, b) => a - b);
      const rawText = claims
        .filter(c => next.includes(c.claim_num))
        .map(c => `청구항 ${c.claim_num} (${c.is_independent ? "독립항" : "종속항"}): ${c.text}`)
        .join("\n\n");
      setAddForm(f => ({ ...f, source_claim: next.join(", "), raw_text: rawText }));
      return next;
    });
  };

  const selectedClaimsText = claims
    .filter(c => selectedClaimNums.includes(c.claim_num))
    .map(c => `청구항 ${c.claim_num} (${c.is_independent ? "독립항" : "종속항"}): ${c.text}`)
    .join("\n\n");

  const handleExtractWithLLM = async (extractWith: "claude" | "ollama") => {
    if (selectedClaimNums.length === 0) return;
    setExtractingModel(extractWith);
    try {
      const currentPageElements = addPanelAppNumber === baseAppNumber
        ? (parseData?.base_elements ?? [])
        : (parseData?.prior_elements?.[addPanelAppNumber] ?? []);
      const existingEls = currentPageElements.map((e: InvalElementResponse) => ({
        name: e.name, function: e.function ?? null,
      }));
      const result = await invalExtractFromClaims({
        base_app_number: addPanelAppNumber || baseAppNumber,
        selected_claim_nums: selectedClaimNums,
        existing_elements: existingEls,
        model: extractWith,
      });
      if (result.length > 0) {
        const el = result[0];
        setAddForm({
          name: el.name ?? "",
          function: el.function ?? "",
          modifier: el.modifier ?? "",
          embedding_text: el.embedding_text ?? "",
          criticality: el.criticality ?? 3,
          criticality_reason: el.criticality_reason ?? "",
          source_claim: el.source_claim ?? selectedClaimNums.join(", "),
          raw_text: el.raw_text ?? "",
        });
        setAddMode("manual");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setExtractingModel(null);
    }
  };

  const handleSaveNewElement = async () => {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    try {
      const currentAppNum = addPanelAppNumber || baseAppNumber;
      const isBasePanel = currentAppNum === baseAppNumber;
      const saved = await invalAddElement({
        base_app_number: baseAppNumber,
        application_number: currentAppNum,
        session_id: sessionId,
        model,
        ...addForm,
        criticality: Number(addForm.criticality),
      });
      setParseData(prev => {
        if (!prev) return prev;
        if (isBasePanel) {
          return { ...prev, base_elements: [...prev.base_elements, saved] };
        } else {
          return {
            ...prev,
            prior_elements: {
              ...prev.prior_elements,
              [currentAppNum]: [...(prev.prior_elements[currentAppNum] ?? []), saved],
            },
          };
        }
      });
      setShowAddPanel(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setAddSaving(false);
    }
  };

  const handleRunAnalysis = async () => {
    setPhase("analyzing");
    setError(null);
    try {
      const hasAdded = (parseData?.base_elements ?? []).some(e => e.id < 0);
      const hasOverrides = overriddenIds.size > 0 || hasAdded;
      const res = await invalRunAnalysis(baseAppNumber, hasOverrides, hasOverrides ? sessionId : undefined, true, model);
      setResult(res);
      if (res.result_json) {
        const p = JSON.parse(res.result_json);
        setParsed(p);
        invalGetElements(baseAppNumber, baseAppNumber, model).then(setBaseElements).catch(console.error);
        const priorNums: string[] = JSON.parse(res.prior_app_numbers || "[]");
        priorNums.forEach(num => {
          invalGetPatentInfo(num).then(info => setPriorInfoMap(prev => ({ ...prev, [num]: info }))).catch(console.error);
        });
      }
      setPhase("done");
      if (typeof window !== "undefined") sessionStorage.setItem(`result_${baseAppNumber}_${model}`, JSON.stringify(res));
      router.replace(`/prior-art/analysis?base=${encodeURIComponent(baseAppNumber)}&cached=${cachedParam}&phase=done&model=${model}`);

      sessionStorage.setItem(`interp_pending_${res.id}`, "1");
      setInterpLoading(true);
      setShowInterp(true);
      invalGenerateInterpretation(res.id, model)
        .then(interp => {
          sessionStorage.removeItem(`interp_pending_${res.id}`);
          const updated = { ...res, interpretation: interp };
          setResult(updated);
          if (typeof window !== "undefined") sessionStorage.setItem(`result_${baseAppNumber}_${model}`, JSON.stringify(updated));
        })
        .catch(e => console.error("해석 생성 실패:", e))
        .finally(() => setInterpLoading(false));

    } catch (e: any) {
      setError(e.message);
      setPhase("review");
    }
  };

  const handleStartEdit = (el: InvalElementResponse) => {
    setEditingId(el.id);
    setEditForm({
      name: el.name,
      function: el.function ?? "",
      embedding_text: el.embedding_text ?? "",
      criticality: el.criticality ?? undefined,
      criticality_reason: el.criticality_reason ?? "",
      raw_text: el.raw_text ?? "",
    });
  };

  const handleSaveEdit = async (el: InvalElementResponse) => {
    setSavingId(el.id);
    try {
      await invalSaveOverride(sessionId, el.id, baseAppNumber, editForm, model);
      const preview = { ...el, ...editForm };
      if (parseData) {
        setParseData({
          ...parseData,
          base_elements: parseData.base_elements.map(e => e.id === el.id ? preview : e),
          prior_elements: Object.fromEntries(
            Object.entries(parseData.prior_elements).map(([k, arr]) => [
              k, arr.map(e => e.id === el.id ? preview : e),
            ])
          ),
        });
      }
      setOverriddenIds(prev => new Set(prev).add(el.id));
      setEditingId(null);
      setEditForm({});
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSavingId(null);
    }
  };

  // ── 결과 파생값 ──
  const matrix: number[][] = parsed?.matrix ?? [];
  const refNames: string[] = parsed?.ref_names ?? [];
  const candNames: string[] = parsed?.cand_names ?? [];
  const selectedCombo: any[] = parsed?.selected_combination ?? [];
  const weightedCoverage = parsed?.weighted_coverage ?? (result?.coverage ?? 0);
  const uncovered: string[] = parsed?.uncovered_elements ?? [];
  const priorAppNumbers: string[] = result ? JSON.parse(result.prior_app_numbers || "[]") : [];
  const interpretation = result?.interpretation
    ? (() => { try { return JSON.parse(result.interpretation!); } catch { return null; } })()
    : null;
  const coveragePct = Math.round(weightedCoverage * 100);
  const coverageColor = weightedCoverage >= 0.8 ? "#dc2626" : weightedCoverage >= 0.5 ? "#d97706" : "#16a34a";
  const coverageLabel = weightedCoverage >= 0.8 ? "무효화 가능성 높음" : weightedCoverage >= 0.5 ? "무효화 가능성 중간" : "무효화 가능성 낮음";
  const coverageBg = weightedCoverage >= 0.8 ? "#fef2f2" : weightedCoverage >= 0.5 ? "#fffbeb" : "#f0fdf4";
  const coverageBorder = weightedCoverage >= 0.8 ? "#fecaca" : weightedCoverage >= 0.5 ? "#fde68a" : "#bbf7d0";
  const avgSimByPrior = candNames.map((_, idx) =>
    matrix.length > 0 ? matrix.map(row => row[idx] ?? 0).reduce((a, b) => a + b, 0) / matrix.length : 0
  );
  const isSingleFullCover = selectedCombo.length === 1 && uncovered.length === 0;
  const topPriorIdx = priorAppNumbers.indexOf(selectedCombo[0]?.patent_id);
  const topPriorAvgSim = avgSimByPrior[topPriorIdx] ?? 0;

  const phaseLabel = phase === "parsing" ? "특허 파싱" : phase === "review" ? "구성요소 검토" : phase === "analyzing" ? "무효화 분석" : "무효화 분석 결과";

  return (
    <>

      {/* 청구항 모달 */}
      {showClaimsModal && (
        <div
          onClick={() => setShowClaimsModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 16, width: 420, maxWidth: "90vw", maxHeight: "55vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
          >
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>청구항 목록</div>
              <button onClick={() => setShowClaimsModal(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94a3b8", lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
              {modalClaimsLoading ? (
                <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "32px 0" }}>청구항 불러오는 중...</div>
              ) : modalClaims.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8", textAlign: "center", padding: "32px 0" }}>청구항 정보가 없습니다</div>
              ) : modalClaims.map(c => (
                <div key={c.claim_num} style={{ borderRadius: 10, border: "1px solid #e2e8f0", padding: "12px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 6 }}>
                    청구항 {c.claim_num} {c.is_independent ? "(독립항)" : "(종속항)"}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8 }}>{c.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif", background: "#f8fafc", minHeight: "100vh", color: "#0f172a" }}>

        {/* 제목 영역 */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 40px 0" }}>
          <button onClick={() => phase === "done" ? setPhase("review") : router.push(`/prior-art?base=${encodeURIComponent(baseAppNumber)}&model=${model}`)} aria-label="뒤로"
            style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, padding: "6px 12px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", color: "#64748b", fontSize: 13 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            뒤로가기
          </button>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>{phaseLabel}</div>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5 }}>
            {baseInfo?.title ?? baseAppNumber}
          </h1>
          <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{baseAppNumber}</div>
        </div>

        <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 40px 64px" }}>

          {/* ── 파싱 중 ── */}
          {phase === "parsing" && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b" }}>특허 파싱 중...</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>청구항 분석 및 구성요소 추출 중입니다</div>
            </div>
          )}

          {/* ── 구성요소 검토 ── */}
          {phase === "review" && (() => {
            if (!parseData) return error ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px", color: "#dc2626" }}>
                오류: {error}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>파싱 결과가 없습니다</div>
            );

            const totalSteps = 1 + parseData.prior_app_numbers.length;
            const isBase = reviewStep === 0;
            const priorAppNum = !isBase ? parseData.prior_app_numbers[reviewStep - 1] : null;
            const stepInfo = isBase ? baseInfo : (priorAppNum ? priorInfoMap[priorAppNum] : null);
            const isPriorLoading = !isBase && priorAppNum ? priorLoadingNums.has(priorAppNum) : false;
            const stepElements = isBase
              ? parseData.base_elements
              : (priorAppNum ? (parseData.prior_elements[priorAppNum] ?? []) : []);
            const isLastStep = reviewStep === totalSteps - 1;
            const allPriorsLoaded = priorLoadingNums.size === 0 &&
              parseData.prior_app_numbers.every(n => parseData.prior_elements[n] !== undefined);
            const nextPriorNum = parseData.prior_app_numbers[reviewStep];
            const nextTabLoading = !isLastStep && !!nextPriorNum && (priorLoadingNums.has(nextPriorNum) || parseData.prior_elements[nextPriorNum] === undefined);

            return (
              <>
                {/* 편집 내용 저장 버튼 */}
                {overriddenIds.size > 0 && (
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                    <button
                      onClick={() => {
                        const edited: any[] = [];
                        parseData!.base_elements.forEach(el => {
                          if (overriddenIds.has(el.id)) edited.push({ type: "기준특허", ...el });
                        });
                        parseData!.prior_app_numbers.forEach(appNum => {
                          (parseData!.prior_elements[appNum] ?? []).forEach(el => {
                            if (overriddenIds.has(el.id)) edited.push({ type: "선행발명", patent: appNum, ...el });
                          });
                        });
                        const blob = new Blob([JSON.stringify({ base_app_number: baseAppNumber, session_id: sessionId, edited_elements: edited }, null, 2)], { type: "application/json" });
                        const a = document.createElement("a");
                        a.href = URL.createObjectURL(blob);
                        a.download = `edits_${baseAppNumber}.json`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      style={{ padding: "7px 16px", background: "#fff", border: "1px solid #c4b5fd", borderRadius: 8, fontSize: 12, cursor: "pointer", color: "#7c3aed", fontWeight: 600 }}>
                      ↓ 편집 내용 저장 ({overriddenIds.size}개)
                    </button>
                  </div>
                )}

                {/* 스텝 탭 바 */}
                <div style={{ display: "flex", gap: 4, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const tabPriorNum = i > 0 ? parseData.prior_app_numbers[i - 1] : null;
                    const isLoading = i > 0 && tabPriorNum ? priorLoadingNums.has(tabPriorNum) : false;
                    const stepHasEdit = i === 0
                      ? parseData.base_elements.some(e => overriddenIds.has(e.id))
                      : (parseData.prior_elements[parseData.prior_app_numbers[i - 1]] ?? []).some(e => overriddenIds.has(e.id));
                    return (
                      <button key={i} onClick={() => { setReviewStep(i); setEditingId(null); setEditForm({}); setShowAddPanel(false); }}
                        style={{
                          padding: "5px 14px", borderRadius: 100, fontSize: 12, border: "none", cursor: "pointer", flexShrink: 0,
                          background: i === reviewStep ? "#1e40af" : stepHasEdit ? "#ede9fe" : "#f1f5f9",
                          color: i === reviewStep ? "#fff" : stepHasEdit ? "#7c3aed" : "#64748b",
                          fontWeight: i === reviewStep ? 700 : 500,
                          opacity: isLoading ? 0.6 : 1,
                        }}>
                        {i === 0 ? "기준특허" : `선행발명 ${i}`}
                        {isLoading && " ⏳"}
                        {!isLoading && stepHasEdit && i !== reviewStep && " ✓"}
                      </button>
                    );
                  })}
                </div>

                {isPriorLoading && (
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "16px 20px", color: "#1e40af", marginBottom: 16, fontSize: 14 }}>
                    ⏳ 선행발명 구성요소 추출 중입니다... 잠시 후 자동으로 표시됩니다.
                  </div>
                )}

                <div style={{ background: "#1e293b", borderRadius: 14, padding: "28px 32px", marginBottom: 16, color: "#fff" }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    {isBase ? "기준특허" : `선행발명 ${reviewStep}`} &nbsp;·&nbsp; {reviewStep + 1} / {totalSteps}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.4 }}>
                    {stepInfo?.title ?? (priorAppNum ?? baseAppNumber)}
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 6 }}>
                    {isBase ? baseAppNumber : priorAppNum}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
                  {[
                    ["출원일", stepInfo?.filing_date ?? "-"],
                    ["출원인", stepInfo?.applicant_name ?? "-"],
                    ["구성요소", `${stepElements.length}개`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0" }}>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>{label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
                    </div>
                  ))}
                  <div
                    onClick={() => handleOpenClaimsModal(isBase ? baseAppNumber : (priorAppNum ?? baseAppNumber))}
                    style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e2e8f0", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#93c5fd")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#e2e8f0")}
                  >
                    <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6 }}>청구항</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e40af" }}>보기</div>
                  </div>
                </div>

                <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", padding: "24px 28px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
                    {isBase ? "● 기준특허 구성요소 (Claims)" : "● 선행발명 구성요소"}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {stepElements.map((el, i) => (
                      <div key={el.id} style={{ border: `1px solid ${overriddenIds.has(el.id) ? "#c4b5fd" : "#f1f5f9"}`, borderRadius: 12, overflow: "hidden" }}>
                        <div style={{ background: overriddenIds.has(el.id) ? "#faf5ff" : "#f8fafc", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${overriddenIds.has(el.id) ? "#e9d5ff" : "#f1f5f9"}` }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                            <span style={{ width: 22, height: 22, background: "#1e40af", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                              {i + 1}
                            </span>
                            {editingId === el.id ? (
                              <input
                                value={editForm.name ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                                style={{ flex: 1, padding: "4px 8px", border: "1px solid #93c5fd", borderRadius: 6, fontSize: 14, fontWeight: 700, outline: "none", background: "#fff", color: "#0f172a" }}
                              />
                            ) : (
                              <span style={{ fontSize: 14, fontWeight: 700 }}>{el.name}</span>
                            )}
                            {overriddenIds.has(el.id) && (
                              <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 100, background: "#ede9fe", color: "#7c3aed", fontWeight: 600, flexShrink: 0 }}>수정됨</span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                            {isBase && el.criticality != null && (
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 11, color: "#94a3b8" }}>중요도</div>
                                <div style={{ fontWeight: 800, fontSize: 14, color: el.criticality >= 4 ? "#dc2626" : el.criticality >= 3 ? "#d97706" : "#94a3b8" }}>
                                  {el.criticality}
                                </div>
                              </div>
                            )}
                            <button
                              onClick={() => editingId === el.id ? (setEditingId(null), setEditForm({})) : handleStartEdit(el)}
                              style={{ padding: "5px 14px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, cursor: "pointer", background: editingId === el.id ? "#f1f5f9" : "#fff", color: "#475569" }}>
                              {editingId === el.id ? "취소" : "수정"}
                            </button>
                          </div>
                        </div>
                        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                          {el.function && (
                            <div>
                              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em" }}>기능</div>
                              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{el.function}</div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, letterSpacing: "0.05em" }}>유사도 분석 기준 텍스트</div>
                            {editingId === el.id ? (
                              <textarea
                                value={editForm.embedding_text ?? ""}
                                onChange={e => setEditForm(f => ({ ...f, embedding_text: e.target.value }))}
                                rows={3}
                                style={{ width: "100%", padding: "10px 14px", border: "1px solid #93c5fd", borderRadius: 8, fontSize: 13, lineHeight: 1.8, resize: "vertical", boxSizing: "border-box", outline: "none", background: "#f0f9ff", color: "#0f172a" }}
                              />
                            ) : (
                              <div style={{ background: "#f0f9ff", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#374151", lineHeight: 1.8, border: "1px solid #bae6fd" }}>
                                {el.embedding_text}
                              </div>
                            )}
                          </div>
                          {!isBase && el.correspondence && (
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, letterSpacing: "0.05em" }}>기준특허 대응</div>
                                {el.base_element_id && el.base_element_id !== "없음" && el.base_element_id !== "N/A" && (
                                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 100, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
                                    구성요소 {el.base_element_id.replace(/E/g, "").replace(/,\s*/g, ", ")}
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{el.correspondence}</div>
                            </div>
                          )}
                          {el.source_claim && (
                            <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>
                              청구항 {el.source_claim} 참조
                            </div>
                          )}
                          {editingId === el.id && (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button onClick={() => handleSaveEdit(el)} disabled={savingId === el.id}
                                style={{ padding: "6px 18px", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", background: "#1e40af", color: "#fff", fontWeight: 600, opacity: savingId === el.id ? 0.6 : 1 }}>
                                {savingId === el.id ? "저장 중..." : "저장"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 구성요소 추가 패널 */}
                {(
                  <div style={{ marginBottom: 16 }}>
                    {!showAddPanel ? (
                      <button onClick={() => handleOpenAddPanel(isBase ? baseAppNumber : (priorAppNum ?? baseAppNumber))}
                        style={{ width: "100%", padding: "10px", border: "1px dashed #93c5fd", borderRadius: 8, background: "#f0f9ff", color: "#1e40af", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        + 구성요소 추가
                      </button>
                    ) : (
                      <div style={{ border: "1px solid #bfdbfe", borderRadius: 12, padding: "20px", background: "#f0f9ff" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e40af", marginBottom: 14 }}>구성요소 추가</div>

                        {/* 청구항 목록 - 클릭으로 선택 */}
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>
                            청구항 선택 {selectedClaimNums.length > 0 && <span style={{ color: "#1e40af" }}>({selectedClaimNums.join(", ")} 선택됨)</span>}
                          </div>
                          {claimsLoading ? (
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>청구항 불러오는 중...</div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                              {[...claims].sort((a, b) => a.claim_num - b.claim_num).map(c => {
                                const selected = selectedClaimNums.includes(c.claim_num);
                                return (
                                  <div key={c.claim_num} onClick={() => toggleClaim(c.claim_num)}
                                    style={{
                                      padding: "10px 14px", borderRadius: 8, cursor: "pointer", lineHeight: 1.7,
                                      border: selected ? "2px solid #1e40af" : "1px solid #e2e8f0",
                                      background: selected ? "#dbeafe" : "#fff",
                                    }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: selected ? "#1e40af" : "#64748b", marginBottom: 4 }}>
                                      청구항 {c.claim_num} {c.is_independent ? "(독립항)" : "(종속항)"}
                                    </div>
                                    <div style={{ fontSize: 12, color: selected ? "#1e40af" : "#374151" }}>{c.text}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* 구성요소 추출 버튼 */}
                        {selectedClaimNums.length > 0 && (
                          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                            <button onClick={() => handleExtractWithLLM("claude")} disabled={extractingModel !== null}
                              style={{ padding: "6px 16px", background: extractingModel === "claude" ? "#94a3b8" : "#1e40af", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: extractingModel !== null ? "default" : "pointer" }}>
                              {extractingModel === "claude" ? "Claude 추출 중..." : "Claude로 구성요소 추출"}
                            </button>
                            <button onClick={() => handleExtractWithLLM("ollama")} disabled={extractingModel !== null}
                              style={{ padding: "6px 16px", background: extractingModel === "ollama" ? "#94a3b8" : "#7c3aed", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: extractingModel !== null ? "default" : "pointer" }}>
                              {extractingModel === "ollama" ? "Ollama 추출 중..." : "Ollama로 구성요소 추출"}
                            </button>
                          </div>
                        )}

                        {/* 구성요소 입력 폼 */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                          {[
                            { key: "name", label: "이름 *", placeholder: "구성요소 원문 이름" },
                            { key: "function", label: "기능", placeholder: "입력-수행-출력 포함한 기능 설명" },
                            { key: "embedding_text", label: "유사도 분석 기준 텍스트", placeholder: "이 구성요소를 나타내는 1~3문장" },
                          ].map(({ key, label, placeholder }) => (
                            <div key={key}>
                              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>{label}</div>
                              <textarea value={(addForm as any)[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                                placeholder={placeholder}
                                style={{ width: "100%", padding: "8px 10px", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 12, lineHeight: 1.6, resize: "vertical", outline: "none", boxSizing: "border-box", minHeight: key === "function" || key === "embedding_text" ? 72 : 40 }} />
                            </div>
                          ))}
                          {addForm.raw_text && (
                            <div>
                              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>청구항 원문</div>
                              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                                {addForm.raw_text}
                              </div>
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 3 }}>중요도 (0~5)</div>
                            <input type="number" min={0} max={5} value={addForm.criticality}
                              onChange={e => setAddForm(f => ({ ...f, criticality: Number(e.target.value) }))}
                              style={{ width: 60, padding: "6px 10px", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 12, outline: "none" }} />
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={handleSaveNewElement} disabled={addSaving || !addForm.name.trim()}
                            style={{ padding: "8px 20px", background: addSaving || !addForm.name.trim() ? "#94a3b8" : "#1e40af", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: addSaving || !addForm.name.trim() ? "default" : "pointer" }}>
                            {addSaving ? "저장 중..." : "추가"}
                          </button>
                          <button onClick={() => setShowAddPanel(false)}
                            style={{ padding: "8px 20px", background: "#fff", color: "#64748b", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 13, cursor: "pointer" }}>
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 하단 탭 바 */}
                <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
                  {Array.from({ length: totalSteps }, (_, i) => {
                    const tabPriorNum = i > 0 ? parseData.prior_app_numbers[i - 1] : null;
                    const isLoading = i > 0 && tabPriorNum ? priorLoadingNums.has(tabPriorNum) : false;
                    const stepHasEdit = i === 0
                      ? parseData.base_elements.some(e => overriddenIds.has(e.id))
                      : (parseData.prior_elements[parseData.prior_app_numbers[i - 1]] ?? []).some(e => overriddenIds.has(e.id));
                    return (
                      <button key={i} onClick={() => { setReviewStep(i); setEditingId(null); setEditForm({}); setShowAddPanel(false); }}
                        style={{
                          padding: "5px 14px", borderRadius: 100, fontSize: 12, border: "none", cursor: "pointer", flexShrink: 0,
                          background: i === reviewStep ? "#1e40af" : stepHasEdit ? "#ede9fe" : "#f1f5f9",
                          color: i === reviewStep ? "#fff" : stepHasEdit ? "#7c3aed" : "#64748b",
                          fontWeight: i === reviewStep ? 700 : 500,
                          opacity: isLoading ? 0.6 : 1,
                        }}>
                        {i === 0 ? "기준특허" : `선행발명 ${i}`}
                        {isLoading && " ⏳"}
                        {!isLoading && stepHasEdit && i !== reviewStep && " ✓"}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={() => { setReviewStep(s => s - 1); setEditingId(null); setEditForm({}); setShowAddPanel(false); }}
                    disabled={reviewStep === 0}
                    style={{ padding: "10px 24px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, cursor: reviewStep === 0 ? "default" : "pointer", background: "#fff", color: reviewStep === 0 ? "#cbd5e1" : "#475569" }}>
                    ← 이전
                  </button>
                  <span style={{ fontSize: 13, color: "#94a3b8" }}>{reviewStep + 1} / {totalSteps}</span>
                  {!isLastStep ? (
                    <button
                      onClick={() => { if (!nextTabLoading) { setReviewStep(s => s + 1); setEditingId(null); setEditForm({}); setShowAddPanel(false); } }}
                      disabled={nextTabLoading}
                      style={{ padding: "10px 24px", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: nextTabLoading ? "default" : "pointer", background: nextTabLoading ? "#cbd5e1" : "#1e40af", color: nextTabLoading ? "#94a3b8" : "#fff" }}>
                      다음 →
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {!allPriorsLoaded && (
                        <span style={{ fontSize: 12, color: "#94a3b8" }}>
                          선행발명 파싱 중... ({Object.keys(parseData.prior_elements).length}/{parseData.prior_app_numbers.length})
                        </span>
                      )}
                      {overriddenIds.size > 0 && <span style={{ fontSize: 12, color: "#7c3aed" }}>{overriddenIds.size}개 수정됨</span>}
                      <button onClick={handleRunAnalysis} disabled={!allPriorsLoaded}
                        style={{ padding: "12px 32px", border: "none", borderRadius: 8, fontSize: 15, cursor: allPriorsLoaded ? "pointer" : "default", background: allPriorsLoaded ? "#1e40af" : "#94a3b8", color: "#fff", fontWeight: 700, boxShadow: allPriorsLoaded ? "0 2px 8px rgba(30,64,175,0.3)" : "none" }}>
                        분석 시작
                      </button>
                    </div>
                  )}
                </div>
              </>
            );
          })()}

          {/* ── 분석 중 ── */}
          {phase === "analyzing" && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#94a3b8" }}>
              <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#64748b" }}>분석 중입니다...</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>무효화 가능성 분석 중</div>
            </div>
          )}

          {/* ── 에러 (done) ── */}
          {phase === "done" && error && !parsed && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "16px 20px", color: "#dc2626", marginBottom: 24 }}>
              오류: {error}
            </div>
          )}

          {/* ── 결과 ── */}
          {phase === "done" && result && (
            <>
              {/* 다운로드 버튼 */}
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 8, alignItems: "center" }}>
                {overriddenIds.size > 0 && (
                  <span style={{ fontSize: 12, color: "#7c3aed" }}>개인 분석 결과 ({overriddenIds.size}개 수정)</span>
                )}
                <button
                  onClick={() => invalDownloadAnalysis(baseAppNumber, overriddenIds.size > 0 ? sessionId : undefined).catch(e => alert(e.message))}
                  style={{ padding: "8px 18px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, cursor: "pointer", color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  ↓ 결과 다운로드 (JSON)
                </button>
              </div>

              {/* 상단 요약 (2패널) */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 24, background: "#fff", borderRadius: 14, padding: "24px 32px", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                {/* 왼쪽: 게이지 */}
                <div style={{ flex: 1.6, display: "flex", alignItems: "center", gap: 20, paddingRight: 36 }}>
                  <div style={{ position: "relative", width: 90, height: 90, flexShrink: 0 }}>
                    <svg viewBox="0 0 90 90" width="90" height="90">
                      <circle cx="45" cy="45" r="36" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                      <circle cx="45" cy="45" r="36" fill="none" stroke={coverageColor} strokeWidth="7"
                        strokeDasharray="226.2"
                        strokeDashoffset={226.2 * (1 - weightedCoverage)}
                        strokeLinecap="round" transform="rotate(-90 45 45)" />
                    </svg>
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 18, fontWeight: 700, color: coverageColor, lineHeight: 1 }}>{coveragePct}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>종합 무효화 가능성</span>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                      <span style={{ fontSize: 30, fontWeight: 700, color: coverageColor, lineHeight: 1 }}>{coveragePct}%</span>
                      <span style={{ fontSize: 13, color: "#d97706", fontWeight: 600 }}>
                        {refNames.length - uncovered.length}/{refNames.length} 구성요소
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      {uncovered.length === 0 ? "모든 구성요소 커버됨" : `${uncovered.length}개 미커버`}
                    </span>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: coverageBg, borderRadius: 5, padding: "3px 9px", width: "fit-content", border: `1px solid ${coverageBorder}` }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: coverageColor }} />
                      <span style={{ fontSize: 11, color: coverageColor, fontWeight: 600 }}>{coverageLabel}</span>
                    </div>
                  </div>
                </div>

                {/* 구분선 */}
                <div style={{ width: 1, alignSelf: "stretch", background: "#e2e8f0" }} />

                {/* 오른쪽: 최소 무효화 조합 */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, paddingLeft: 36 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>최소 무효화 조합</span>
                  <span style={{ fontSize: 30, fontWeight: 700, color: "#1e40af", lineHeight: 1 }}>{selectedCombo.length}개</span>
                  {selectedCombo.length === 1 ? (
                    <>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{selectedCombo[0]?.patent_id ?? "-"}</span>
                      <span style={{ fontSize: 12, color: "#475569" }}>{priorInfoMap[selectedCombo[0]?.patent_id]?.title ?? ""}</span>
                      {uncovered.length === 0 && (
                        <>
                          <span style={{ fontSize: 12, color: "#475569" }}>
                            평균 유사도{" "}
                            <span style={{ fontWeight: 700, color: topPriorAvgSim >= 0.85 ? "#dc2626" : topPriorAvgSim >= 0.75 ? "#d97706" : "#64748b" }}>
                              {(topPriorAvgSim * 100).toFixed(1)}%
                            </span>
                          </span>
                          <span style={{ fontSize: 11, color: "#94a3b8" }}>단독으로 전체 커버 가능</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      {selectedCombo.map((item, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, color: "#1e40af", fontWeight: 700 }}>{i + 1}.</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>{item.patent_id}</span>
                        </div>
                      ))}
                      {uncovered.length === 0 && (
                        <span style={{ fontSize: 11, color: "#94a3b8" }}>{selectedCombo.length}개 조합으로 전체 커버 가능</span>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* 기준특허 구성요소 바 차트 */}
              {baseElements.length > 0 && matrix.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #e2e8f0", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>기준특허 구성요소</div>
                  <div style={{ fontSize: 10, color: "#696b6d", lineHeight: 1.7, marginBottom: 16 }}>
                    특허의 보호 범위를 정의하는 핵심 요소로, 선행발명이 이 요소들을 모두 포함할 수 있다면 진보성이 없다고 판단되어 무효화될 수 있습니다. 아래 막대는 각 요소가 선행발명과 얼마나 기술적으로 유사한지를 나타내며, 길고 진할수록 무효화 위험이 높습니다.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {baseElements.map((el, i) => {
                      const max = matrix[i] ? Math.max(...matrix[i]) : 0;
                      return (
                        <div key={el.id}
                          style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 10, border: "1px solid #f1f5f9", background: "#f8fafc", cursor: "default" }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(30,64,175,0.12)";
                            (e.currentTarget as HTMLElement).style.borderColor = "#93c5fd";
                            const tip = (e.currentTarget as HTMLElement).querySelector(".tooltip") as HTMLElement;
                            if (tip) tip.style.display = "block";
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.boxShadow = "none";
                            (e.currentTarget as HTMLElement).style.borderColor = "#f1f5f9";
                            const tip = (e.currentTarget as HTMLElement).querySelector(".tooltip") as HTMLElement;
                            if (tip) tip.style.display = "none";
                          }}>
                          <div style={{ width: 22, height: 22, borderRadius: 100, background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <span style={{ fontSize: 11, color: "#1e40af", fontWeight: 800 }}>{i + 1}</span>
                          </div>
                          <div style={{ width: 120, fontSize: 14, fontWeight: 700, color: "#0f172a", flexShrink: 0 }}>{el.name}</div>
                          <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 100, overflow: "hidden" }}>
                            <div style={{ width: `${max * 100}%`, height: 8, background: barBg(max), borderRadius: 100, transition: "width 1s" }} />
                          </div>
                          <div style={{ width: 36, fontSize: 13, fontWeight: 700, color: barBg(max), textAlign: "right", flexShrink: 0 }}>
                            {max.toFixed(2)}
                          </div>
                          <div className="tooltip" style={{
                            display: "none", position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
                            background: "#fff", color: "#0f172a", borderRadius: 10, padding: "12px 16px",
                            fontSize: 12, lineHeight: 1.6, width: 260, zIndex: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                            pointerEvents: "none", whiteSpace: "pre-wrap"
                          }}>
                            <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                              <span>{el.name}</span>
                              <span style={{ fontSize: 12, color: "#529cf1", fontWeight: 600, whiteSpace: "nowrap" }}>중요도 {el.criticality ?? "-"}/5</span>
                            </div>
                            <div style={{ color: "#475569" }}>{el.function}</div>
                            <div style={{ position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)", width: 12, height: 12, background: "#fff", rotate: "45deg" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 유사도 히트맵 */}
              {matrix.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #e2e8f0", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>기준특허 구성요소 × 선행발명 유사도</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 13, width: "100%" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "0 16px 10px 0", color: "#94a3b8", fontWeight: 500, fontSize: 12 }}>구성요소</th>
                          {candNames.map((n, idx) => {
                            const maxSim = matrix.length > 0 ? Math.max(...matrix.map(row => row[idx] ?? 0)) : 0;
                            const priorNum = priorAppNumbers[idx];
                            const priorInfo = priorInfoMap[priorNum];
                            return (
                              <th key={n}
                                onClick={() => router.push(`/prior-art/patent/${encodeURIComponent(priorNum)}?base=${encodeURIComponent(baseAppNumber)}&similarity=${maxSim.toFixed(3)}&avgSimilarity=${avgSimByPrior[idx].toFixed(3)}&session_id=${encodeURIComponent(sessionId)}`)}
                                style={{ padding: "0 6px 10px", color: "#1e40af", fontWeight: 600, fontSize: 12, textAlign: "center", cursor: "pointer", position: "relative" }}
                                onMouseEnter={e => {
                                  const tip = (e.currentTarget as HTMLElement).querySelector(".prior-tooltip") as HTMLElement;
                                  if (tip) tip.style.display = "block";
                                }}
                                onMouseLeave={e => {
                                  const tip = (e.currentTarget as HTMLElement).querySelector(".prior-tooltip") as HTMLElement;
                                  if (tip) tip.style.display = "none";
                                }}>
                                <div style={{ fontSize: 10, color: "#6a6a6b", fontWeight: 400, marginBottom: 2 }}>선행발명 {idx + 1}</div>
                                <span style={{ textDecoration: "underline" }}>
                                  {priorNum?.length > 12 ? priorNum.slice(0, 12) + "…" : priorNum}
                                </span>
                                <div className="prior-tooltip" style={{
                                  display: "none", position: "absolute", top: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
                                  background: "#fff", color: "#0f172a", borderRadius: 10, padding: "12px 14px",
                                  fontSize: 11, lineHeight: 1.6, width: "max-content", maxWidth: 200,
                                  zIndex: 300, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", border: "1px solid #e2e8f0",
                                  pointerEvents: "none", textAlign: "left", fontWeight: 400, textDecoration: "none", whiteSpace: "normal"
                                }}>
                                  <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6, fontSize: 11, lineHeight: 1.5 }}>{priorInfo?.title ?? "로딩 중..."}</div>
                                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                                    <div style={{ color: "#50545e" }}>출원번호 <span style={{ color: "#0f172a" }}>{priorNum}</span></div>
                                    <div style={{ color: "#50545e" }}>출원일 <span style={{ color: "#0f172a" }}>{priorInfo?.filing_date ?? "-"}</span></div>
                                    <div style={{ color: "#50545e" }}>출원인 <span style={{ color: "#0f172a" }}>{priorInfo?.applicant_name ?? "-"}</span></div>
                                    <div style={{ color: "#50545e" }}>최고 유사도 <span style={{ fontWeight: 700, color: maxSim >= 0.85 ? "#f87171" : maxSim >= 0.75 ? "#fbbf24" : "#94a3b8" }}>{(maxSim * 100).toFixed(1)}%</span></div>
                                  </div>
                                  <div style={{ position: "absolute", top: -6, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 10, height: 10, background: "#fff", border: "1px solid #e2e8f0", borderBottom: "none", borderRight: "none" }} />
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {matrix.map((row, i) => (
                          <tr key={i}>
                            <td style={{ padding: "4px 16px 4px 0", verticalAlign: "middle" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  <span style={{ fontSize: 10, color: "#1e40af", fontWeight: 800 }}>{i + 1}</span>
                                </div>
                                <span style={{ color: "#374151", fontWeight: 500 }}>
                                  {refNames[i]?.length > 12 ? refNames[i].slice(0, 12) + "…" : refNames[i]}
                                </span>
                              </div>
                            </td>
                            {row.map((v, j) => (
                              <td key={j} style={{ padding: 4 }}>
                                <div style={{ background: cellBg(v), color: cellText(v), padding: "7px 14px", textAlign: "center", borderRadius: 6, fontWeight: v >= 0.75 ? 700 : 400, fontSize: 13 }}>
                                  {v.toFixed(2)}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 14, fontSize: 12, color: "#64748b" }}>
                    {[["#dc2626", "≥0.85 강력"], ["#d97706", "≥0.75 일반"], ["#e2e8f0", "미달"]].map(([c, l]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-block", width: 10, height: 10, background: c, borderRadius: 2 }} />{l}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Greedy 최소 조합 */}
              {!isSingleFullCover && selectedCombo.length > 0 && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #e2e8f0", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>최소 무효화 조합</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {selectedCombo.map((item, i) => {
                      const itemPriorIdx = priorAppNumbers.indexOf(item.patent_id);
                      const itemAvgSim = avgSimByPrior[itemPriorIdx] ?? 0;
                      return (
                        <div key={i} style={{ background: "#eff6ff", borderRadius: 10, padding: "16px 20px", border: "1px solid #bfdbfe" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                            <div>
                              <span style={{ color: "#1e40af", fontWeight: 800, marginRight: 8 }}>{i + 1}.</span>
                              <span style={{ fontSize: 15, fontWeight: 700 }}>{item.patent_id}</span>
                              {priorInfoMap[item.patent_id]?.title && (
                                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{priorInfoMap[item.patent_id].title}</div>
                              )}
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>평균 유사도</div>
                              <div style={{ color: "#1e40af", fontWeight: 800, fontSize: 15 }}>{(itemAvgSim * 100).toFixed(1)}%</div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {item.covered_elements?.map((el: string) => (
                              <span key={el} style={{ padding: "4px 12px", background: "#dbeafe", color: "#1e40af", borderRadius: 100, fontSize: 12, fontWeight: 600 }}>{el}</span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {uncovered.length > 0 && (
                    <div style={{ marginTop: 12, background: "#fffbeb", borderRadius: 10, padding: "12px 16px", border: "1px solid #fde68a", color: "#d97706", fontSize: 13, fontWeight: 600 }}>
                      미커버 구성요소: {uncovered.join(", ")}
                    </div>
                  )}
                  {uncovered.length === 0 && (
                    <div style={{ marginTop: 12, background: "#fef2f2", borderRadius: 10, padding: "12px 16px", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
                      모든 구성요소가 커버됨 — 무효화 가능성 매우 높음
                    </div>
                  )}
                </div>
              )}

              {/* AI 무효화 근거 해석 */}
              <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #e2e8f0", marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>AI 무효화 근거 해석</div>
                  <button
                    onClick={() => interpretation && setShowInterp(v => !v)}
                    disabled={!interpretation}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 13,
                      border: interpretation ? "1px solid #1e40af" : "1px solid #e2e8f0",
                      background: interpretation ? "#1e40af" : "#f8fafc",
                      color: interpretation ? "#fff" : "#94a3b8",
                      cursor: interpretation ? "pointer" : "default",
                    }}>
                    {interpLoading ? "해석 중..." : showInterp ? "접기" : "펼치기"}
                  </button>
                </div>
                {showInterp && (
                  interpLoading ? (
                    <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.8, background: "#f8fafc", borderRadius: 10, padding: "20px 24px", border: "1px solid #f1f5f9" }}>
                      ⏳ AI 해석 생성 중입니다... (30~60초 소요)
                    </div>
                  ) : interpretation ? (
                    <>
                      {/* 종합 요약 */}
                      {interpretation.summary && (
                        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #f1f5f9", marginBottom: 20 }}>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 6 }}>종합 요약</div>
                          <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.8 }}>{interpretation.summary}</div>
                        </div>
                      )}

                      {/* 구성요소별 위험 분석 */}
                      {interpretation.element_risk_analysis?.map((el: any, i: number) => {
                        const riskColor = el.risk_level === "HIGH" ? "#dc2626" : el.risk_level === "MEDIUM" ? "#d97706" : "#16a34a";
                        const riskBg = el.risk_level === "HIGH" ? "#fef2f2" : el.risk_level === "MEDIUM" ? "#fffbeb" : "#f0fdf4";
                        return (
                          <div key={i} style={{ marginBottom: 20, borderLeft: "3px solid #bfdbfe", paddingLeft: 16 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", marginBottom: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                              {el.element_name}
                              {el.risk_level && (
                                <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 100, background: riskBg, color: riskColor, fontWeight: 600 }}>
                                  {el.risk_level === "HIGH" ? "위험 높음" : el.risk_level === "MEDIUM" ? "위험 중간" : "위험 낮음"}
                                </span>
                              )}
                              {el.criticality && <span style={{ fontSize: 11, color: "#94a3b8" }}>{el.criticality}</span>}
                            </div>
                            {el.per_patent_analysis?.map((p: any, j: number) => (
                              <div key={j} style={{ background: "#f8fafc", borderRadius: 8, padding: "14px 16px", border: "1px solid #f1f5f9", marginBottom: 8 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>
                                  {p.patent_id} · 청구항 {String(p.matching_claim_no ?? "").replace(/P/gi, "")} · 유사도 {p.similarity_score?.toFixed(2)}
                                </div>
                                {p.matching_claim_text && (
                                  <div style={{ fontSize: 12, color: "#64748b", background: "#fff", borderRadius: 6, padding: "8px 12px", border: "1px solid #e2e8f0", marginBottom: 6, lineHeight: 1.6, fontStyle: "italic" }}>
                                    "{p.matching_claim_text}"
                                  </div>
                                )}
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, marginBottom: p.difference ? 6 : 0 }}>{p.similarity_reason}</div>
                                {p.difference && <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>차이점: {p.difference}</div>}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* 최소 무효화 조합 상세 */}
                      {interpretation.combo_analysis?.length > 0 && (
                        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #f1f5f9", marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>최소 무효화 조합 상세 분석</div>
                          {interpretation.combo_analysis.map((c: any, i: number) => (
                            <div key={i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < interpretation.combo_analysis.length - 1 ? "1px solid #e2e8f0" : "none" }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e40af", marginBottom: 4 }}>{c.patent_id}</div>
                              {c.overall_assessment && <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{c.overall_assessment}</div>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 선행발명 결합 위험 */}
                      {interpretation.combination_risk?.length > 0 && (
                        <div style={{ background: "#fff7ed", borderRadius: 10, padding: "16px 20px", border: "1px solid #fed7aa", marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 12 }}>선행발명 결합 무효화 위험</div>
                          {interpretation.combination_risk.map((cr: any, i: number) => {
                            const probColor = cr.invalidity_probability === "HIGH" ? "#dc2626" : cr.invalidity_probability === "MEDIUM" ? "#d97706" : "#16a34a";
                            return (
                              <div key={i} style={{ marginBottom: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{cr.patents?.join(" + ")}</span>
                                  <span style={{ fontSize: 11, padding: "1px 8px", borderRadius: 100, background: "#fef2f2", color: probColor, fontWeight: 600 }}>{cr.invalidity_probability}</span>
                                </div>
                                {cr.invalidity_reason && <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{cr.invalidity_reason}</div>}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 법적 판단 */}
                      {interpretation.legal_opinion && (
                        <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px 20px", border: "1px solid #f1f5f9" }}>
                          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 12 }}>법적 판단</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                            {interpretation.legal_opinion.primary_ground && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>주된 무효 근거</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{interpretation.legal_opinion.primary_ground}</div>
                              </div>
                            )}
                            {interpretation.legal_opinion.key_vulnerability && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>핵심 취약점</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{interpretation.legal_opinion.key_vulnerability}</div>
                              </div>
                            )}
                            {interpretation.legal_opinion.defense_points && (
                              <div>
                                <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>방어 포인트</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{interpretation.legal_opinion.defense_points}</div>
                              </div>
                            )}
                            {interpretation.legal_opinion.recommended_action && (
                              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "12px 14px", border: "1px solid #bfdbfe" }}>
                                <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 700, marginBottom: 4 }}>권고 사항</div>
                                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{interpretation.legal_opinion.recommended_action}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 14, color: "#94a3b8", lineHeight: 1.8, background: "#f8fafc", borderRadius: 10, padding: "20px 24px", border: "1px solid #f1f5f9" }}>
                      AI 해석이 없습니다.
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid #e2e8f0", padding: "28px 40px", marginTop: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 22, height: 22, background: "#1e40af", borderRadius: 5, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: 11, fontWeight: 800 }}>씽</span>
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>씽캣</span>
          </div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>© 2026 THINKCAT-ELN. All rights reserved.</div>
        </footer>
      </div>
    </>
  );
}
