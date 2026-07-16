'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "@/routing";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, AlertCircle, Download, Lock } from "lucide-react";
import {
  invalGeneratePriorArtReportStream,
  IdeaPrepareResult,
  PriorArtReportResult,
  PriorArtAnchorAnalysis,
} from "@/lib/invalidation_api";

const cleanText = (text: string) =>
  text
    .replace(/\(criticality\s*\d*\)/gi, "")
    .replace(/앵커/g, "구성요소")
    .replace(/\s{2,}/g, " ")
    .trim();

const SIM_BADGE: Record<string, { bg: string; text: string }> = {
  높음: { bg: "bg-rose-100",    text: "text-rose-700"    },
  보통: { bg: "bg-amber-100",   text: "text-amber-700"   },
  낮음: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

export default function PriorArtReport() {
  const router = useRouter();
  const { data: session } = useSession() as any;
  const token = session?.access_token as string | undefined;

  const [prepareData, setPrepareData] = useState<IdeaPrepareResult | null>(null);
  const [report, setReport]           = useState<PriorArtReportResult | null>(null);
  const [loading, setLoading]         = useState(false);
  const [visibleLineCount, setVisibleLineCount] = useState(0);
  const [elapsed, setElapsed]         = useState(0);
  const [displayText, setDisplayText] = useState("");
  const [streamedAnchors, setStreamedAnchors] = useState<{ name: string; level: string }[]>([]);
  const [error, setError]             = useState<string | null>(null);
  const [errorCode, setErrorCode]     = useState<string | null>(null);
  const [openAnchorId, setOpenAnchorId] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState(false);
  const wordContentRef = useRef<HTMLDivElement>(null);
  const streamStartedRef  = useRef(false);
  const displayBuf        = useRef("");
  const typeQueue         = useRef<string[]>([]);
  const typing            = useRef(false);

  function pushToTypewriter(paragraphs: string[]) {
    typeQueue.current.push(...paragraphs);
    if (typing.current) return;
    typing.current = true;
    pump();
  }
  function pump() {
    const text = typeQueue.current.shift() ?? "";
    if (!text) { typing.current = false; return; }
    let i = 0;
    function step() {
      if (i >= text.length) { setTimeout(pump, 80); return; }
      displayBuf.current = displayBuf.current.length >= 220
        ? "" : displayBuf.current + text[i];
      setDisplayText(displayBuf.current);
      i++;
      setTimeout(step, 14);
    }
    step();
  }
  const model = "claude";

  const handleWordExport = async () => {
    if (!wordContentRef.current) return;
    setWordLoading(true);
    try {
      const htmlDocx = (await import("html-docx-js/dist/html-docx")).default;
      const inner = wordContentRef.current.innerHTML;
      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:"맑은 고딕",sans-serif;font-size:10pt;color:#334155;}h1{font-size:18pt;}h2{font-size:13pt;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #e2e8f0;padding:5px 8px;font-size:9pt;}th{background:#f1f5f9;font-weight:bold;}</style></head><body>${inner}</body></html>`;
      const blob = htmlDocx.asBlob(html);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "선행기술조사보고서.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setWordLoading(false);
    }
  };

  const sortedPatents = useMemo(
    () => prepareData ? [...prepareData.prior_patents].sort((a, b) => (b.similarity_score ?? 0) - (a.similarity_score ?? 0)) : [],
    [prepareData]
  );

  // 스트림 라인 목록 (특허 → 매핑 → 구성요소 분석 전환)
  const streamLines = useMemo(() => {
    if (!sortedPatents.length) return [];
    const lines: { text: string; sub?: string; type: string }[] = [
      { text: `Section 01 · ${sortedPatents.length} Prior Patents`, type: "section" },
      ...sortedPatents.map(p => ({
        text: p.title,
        sub: `${p.application_number}${p.similarity_score != null ? `  ·  ${(p.similarity_score * 100).toFixed(1)}%` : ""}`,
        type: "patent",
      })),
      { text: "Section 02 · Component Analysis", type: "section" },
      ...sortedPatents.map(p => ({
        text: `${p.application_number}  ↔  element matching`,
        sub: "done",
        type: "compare",
      })),
    ];
    return lines;
  }, [sortedPatents]);

  // 라인 순차 등장: 특허는 80ms, 나머지는 320ms
  useEffect(() => {
    if (!loading || !streamLines.length) return;
    setVisibleLineCount(0);
    let count = 0;
    const patentSectionEnd = 1 + sortedPatents.length; // section header + patents

    const tick = () => {
      count++;
      setVisibleLineCount(count);
      if (count >= streamLines.length) return;
      const delay = count < patentSectionEnd ? 180 : 400;
      setTimeout(tick, delay);
    };
    const id = setTimeout(tick, 180);
    return () => clearTimeout(id);
  }, [loading, streamLines.length]);

  // 경과 시간 타이머
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  const streamingDone = visibleLineCount >= streamLines.length && streamLines.length > 0;

  useEffect(() => {
    const raw = sessionStorage.getItem("ideaPrepareData");
    if (!raw) { router.replace("/prior-art"); return; }
    const data: IdeaPrepareResult = JSON.parse(raw);
    setPrepareData(data);

    const cacheKey = `priorArtReport_${data.base_id}_${model}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setReport(JSON.parse(cached)); return; }

    // 토큰 로딩 중이거나 이미 시작된 경우 무시
    if (token === undefined) return;
    if (streamStartedRef.current) return;
    streamStartedRef.current = true;

    setLoading(true);
    setDisplayText("");
    setStreamedAnchors([]);
    displayBuf.current = "";
    typeQueue.current  = [];
    typing.current     = false;
    invalGeneratePriorArtReportStream({
      idea_uuid:         data.idea_uuid,
      base_id:           data.base_id,
      raw_text:          data.raw_text,
      full_text:         data.full_text,
      prior_app_numbers: data.prior_app_numbers,
      idea_title:        data.refined_title ?? "",
      model,
      token,
      onText: () => {},
      onEvent: (ev) => {
        if (ev.event === "anchor_done") {
          setStreamedAnchors(prev => [
            ...prev,
            { name: ev.data.anchor_name, level: ev.data.similarity_level },
          ]);
          const lines: string[] = [];
          for (const comp of ev.data.prior_comparisons ?? []) {
            if (comp.operation)           lines.push(comp.operation);
            if (comp.similarity)          lines.push(comp.similarity);
            if (comp.avoidance_direction) lines.push(comp.avoidance_direction);
          }
          if (lines.length) pushToTypewriter(lines);
        }
      },
    })
      .then(result => {
        setReport(result);
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      })
      .catch(e => {
        const code = e?.code;
        if (code === "no_credits" || code === "expired_trial" || code === "expired_subscription") {
          setErrorCode(code);
        } else {
          setError(e?.message ?? "보고서 생성 중 오류가 발생했습니다");
        }
      })
      .finally(() => setLoading(false));
  }, [token]);

  const analysisMap: Record<string, PriorArtAnchorAnalysis> = {};
  if (report?.report?.anchor_analyses) {
    for (const a of report.report.anchor_analyses) analysisMap[a.anchor_id] = a;
  }

  return (
    <>
      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* ── 검정 전체화면 로딩 오버레이 ── */}
      {loading && prepareData && (
        <div className="fixed inset-0 z-50 bg-[#0a0a0f] flex flex-col">

          {/* 상단 고정 상태 표시 — 항상 보임 */}
          <div className="shrink-0 px-8 pt-10 pb-5 border-b border-white/5 bg-[#0a0a0f]">
            <div className="max-w-2xl mx-auto flex items-center gap-3">
              <span className="text-indigo-400 text-lg leading-none" style={{ animation: "blink 1.4s ease-in-out infinite" }}>✦</span>
              <span className="text-white text-sm font-semibold">Analyzing prior art…</span>
              <span className="text-slate-500 text-xs">
                ({elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`} · still running)
              </span>
            </div>
          </div>

          {/* 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-8 py-8 space-y-0.5">

              {/* Section 01 + patents + Section 02 header: 항상 유지 */}
              {streamLines.slice(0, visibleLineCount).map((line, i) => {
                if (line.type === "compare") return null; // compare는 아래에서 별도 처리
                return (
                  <div
                    key={i}
                    style={{ animation: "slideInLeft 0.22s ease-out both" }}
                    className={line.type === "section"
                      ? "pt-6 pb-1.5 first:pt-0"
                      : "flex items-baseline gap-3 py-0.5 pl-4"
                    }
                  >
                    {line.type === "section" ? (
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{line.text}</p>
                    ) : (
                      <>
                        <span className="text-slate-300 text-sm flex-1 leading-snug">{line.text}</span>
                        {line.sub && <span className="text-slate-600 text-[11px] font-mono shrink-0 whitespace-nowrap">{line.sub}</span>}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Section 02 매핑 행: 애니메이션 중엔 표시, 완료되면 구성요소로 교체 */}
              {!streamingDone && streamLines.slice(0, visibleLineCount).filter(l => l.type === "compare").map((line, i) => (
                <div key={`c${i}`} style={{ animation: "slideInLeft 0.22s ease-out both" }}
                  className="flex items-baseline gap-3 py-0.5 pl-4">
                  <span className="text-slate-500 text-xs font-mono flex-1">{line.text}</span>
                  {line.sub && <span className="text-emerald-700 text-[10px] font-black shrink-0">✓ {line.sub}</span>}
                </div>
              ))}
              {!streamingDone && visibleLineCount > 0 && (
                <div className="pl-4 py-2 flex items-center gap-2">
                  <span className="text-indigo-400 text-xs" style={{ animation: "blink 1.4s ease-in-out infinite" }}>✦</span>
                  <span className="text-slate-500 text-xs">processing...</span>
                </div>
              )}

              {/* streamingDone: 매핑 행 사라지고 구성요소 이름으로 교체 */}
              {streamingDone && (
                <div className="pl-4 space-y-1" style={{ animation: "fadeIn 0.4s ease-out both" }}>
                  {streamedAnchors.length === 0 && (
                    <div className="flex items-center gap-2 py-1">
                      <span className="text-indigo-400 text-xs" style={{ animation: "blink 1.4s ease-in-out infinite" }}>✦</span>
                      <span className="text-slate-500 text-xs">analyzing components...</span>
                    </div>
                  )}
                  {streamedAnchors.map((a, i) => (
                    <div key={i} style={{ animation: "slideInLeft 0.22s ease-out both" }}
                      className="flex items-center gap-3 py-0.5">
                      <span className="text-slate-300 text-sm flex-1">{a.name}</span>
                      <span className={`text-[10px] font-black shrink-0 ${
                        a.level === "높음" ? "text-rose-500" :
                        a.level === "보통" ? "text-amber-500" : "text-emerald-500"
                      }`}>{a.level}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Section 03: streamingDone 이후 등장 */}
              {streamingDone && (
                <div className="pt-8 pb-1 pl-4" style={{ animation: "fadeIn 0.4s ease-out both" }}>
                  <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-3">Section 03 · Rights Strategy</p>
                  <div className="h-[88px] overflow-hidden">
                    {displayText ? (
                      <p className="text-slate-400 text-xs leading-relaxed">
                        {displayText}
                        <span className="inline-block w-[5px] h-[12px] bg-slate-500 align-middle ml-0.5"
                          style={{ animation: "blink 1s step-start infinite" }} />
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 py-1">
                        <span className="text-indigo-400 text-xs" style={{ animation: "blink 1.4s ease-in-out infinite" }}>✦</span>
                        <span className="text-slate-500 text-xs">generating strategy...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50/30">

        {/* 상단 헤더 */}
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-4">
            <button
              onClick={() => router.push("/prior-art")}
              className="group flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
            >
              <div className="p-1 rounded-full bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 transition-colors">
                <ArrowLeft size={16} strokeWidth={3} />
              </div>
              <span className="text-xs font-black text-slate-600 group-hover:text-blue-700">돌아가기</span>
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-black text-slate-900 tracking-tight">선행기술조사보고서</h1>
              {prepareData && (
                <p className="text-xs text-slate-400 mt-0.5 truncate max-w-sm">{prepareData.refined_title}</p>
              )}
            </div>
            {report && prepareData && (
              <button
                onClick={handleWordExport}
                disabled={wordLoading}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-xs font-black rounded-2xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                <Download size={13} />
                {wordLoading ? "변환 중..." : "Word 저장"}
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* 크레딧 에러 모달 */}
          {errorCode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm mx-4 p-8 flex flex-col items-center gap-5 animate-in zoom-in-95 duration-200">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Lock size={26} className="text-slate-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm text-slate-700 whitespace-pre-line text-center">
                    {errorCode === "no_credits"          && "이번 달 이용 한도를 모두 사용했습니다.\n플랜을 변경하여 더 많은 한도를 이용하세요."}
                    {errorCode === "expired_trial"        && "무료 체험이 종료되었습니다.\n계속 이용하려면 플랜을 선택하세요."}
                    {errorCode === "expired_subscription" && "이용 권한이 없습니다.\n플랜을 선택하여 서비스를 이용하세요."}
                  </p>
                </div>
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => router.push("/prior-art")}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-all"
                  >
                    돌아가기
                  </button>
                  <a
                    href="https://help.thinkcat.kr/plan/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm text-center hover:bg-blue-700 transition-all"
                  >
                    플랜 보기
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="flex flex-col items-center gap-4 py-20">
              <AlertCircle size={36} className="text-rose-400" />
              <p className="text-sm font-bold text-rose-600 text-center">{error}</p>
              <button
                onClick={() => router.push("/prior-art")}
                className="px-5 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm hover:bg-slate-200 transition-all"
              >
                돌아가기
              </button>
            </div>
          )}

          {/* ── 섹션 1: 유사 선행 특허 — 로딩 중에도 즉시 표시 ── */}
          {prepareData && (
            <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-[#0f172a] px-6 py-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 01</p>
                <h2 className="text-xl font-black text-white tracking-tight">
                  유사 선행 특허
                  <span className="text-indigo-400 ml-2">{prepareData.prior_patents.length}건</span>
                </h2>
              </div>
              <div className="p-5">
                <div className="max-h-[340px] overflow-y-auto pr-1 space-y-2">
                  {sortedPatents.map((p, i) => (
                    <button
                      key={p.application_number}
                      onClick={() => router.push(`/applicationNum/${p.application_number}`)}
                      style={{ animation: "slideUpFade 0.25s ease-out both" }}
                      className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                    >
                      <span className="text-[11px] font-black text-slate-300 w-4 shrink-0 text-center">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors leading-snug">
                          {p.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {p.application_number}{p.filing_date ? ` · ${p.filing_date}` : ""}{p.applicant_name ? ` · ${p.applicant_name}` : ""}
                        </p>
                      </div>
                      {p.similarity_score != null && (
                        <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-600 border border-blue-200">
                          {(p.similarity_score * 100).toFixed(1)}%
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 섹션 2: 구성요소 종합 검토 ── */}
          {prepareData && (loading || report) && (
            <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="bg-[#0f172a] px-6 py-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 02</p>
                <h2 className="text-xl font-black text-white tracking-tight">구성요소 종합 검토</h2>
              </div>

              {/* 완료 후: 전체 아코디언 뷰 (stagger 애니메이션) */}
              {report && !loading && (
                <div className="divide-y divide-slate-50">
                  {report.per_anchor_data.map((anchor, i) => {
                    const isOpen = openAnchorId === anchor.anchor_id;
                    const analysis = analysisMap[anchor.anchor_id];
                    const sim = SIM_BADGE[anchor.similarity_level] ?? SIM_BADGE["보통"];

                    return (
                      <div
                        key={anchor.anchor_id}
                        style={{ animation: "slideUpFade 0.3s ease-out both", animationDelay: `${i * 40}ms` }}
                      >
                        <button
                          onClick={() => setOpenAnchorId(isOpen ? null : anchor.anchor_id)}
                          className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-300 w-8">{anchor.anchor_id}</span>
                            <span className="text-sm font-black text-slate-900">{anchor.anchor_name}</span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${sim.bg} ${sim.text}`}>
                              {anchor.similarity_level}
                            </span>
                          </div>
                          {isOpen
                            ? <ChevronUp size={15} className="text-slate-300 flex-shrink-0" />
                            : <ChevronDown size={15} className="text-slate-300 flex-shrink-0" />}
                        </button>

                        {isOpen && (
                          <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-6 space-y-5">
                            {(analysis?.prior_comparisons ?? []).map((comp, j) => (
                              <div key={comp.patent_id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                <div className="bg-[#1e293b] px-5 py-3.5 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">#{j + 1}</span>
                                      <span className="text-[10px] text-slate-400">{comp.patent_id}</span>
                                      {(() => {
                                        const tp = anchor.top_priors[j];
                                        const s = tp ? SIM_BADGE[tp.similarity_level] : SIM_BADGE["보통"];
                                        return (
                                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${s.bg} ${s.text}`}>
                                            {tp?.similarity_level}
                                          </span>
                                        );
                                      })()}
                                    </div>
                                    <p className="text-sm font-black text-white leading-snug">{comp.patent_title}</p>
                                  </div>
                                  <button
                                    onClick={() => router.push(`/applicationNum/${comp.patent_id}`)}
                                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white transition-all flex-shrink-0"
                                  >
                                    <ExternalLink size={13} />
                                  </button>
                                </div>

                                <div className="p-5 space-y-4">
                                  <div>
                                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">대응 구성요소</p>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg">{comp.matched_element}</p>
                                      {anchor.top_priors[j]?.best_element_claim && (
                                        <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                          청구항 {anchor.top_priors[j].best_element_claim}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="bg-slate-50 rounded-xl px-4 py-3">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">작동 방식</p>
                                    <p className="text-xs text-slate-700 leading-relaxed">{comp.operation}</p>
                                  </div>
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-rose-50 rounded-xl px-4 py-3">
                                      <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1.5">유사성</p>
                                      <p className="text-xs text-rose-900 leading-relaxed">{comp.similarity}</p>
                                    </div>
                                    <div className="bg-indigo-50 rounded-xl px-4 py-3">
                                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">회피 전략</p>
                                      <p className="text-xs text-indigo-900 leading-relaxed">{comp.avoidance_direction}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}

                            {report.uncovered_anchors.includes(anchor.anchor_name) && (
                              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
                                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">차별화 가능 구성요소</p>
                                <p className="text-xs text-emerald-800">유사도 임계값 이상의 선행발명이 없습니다. 이 구성요소를 중심으로 권리범위를 확보하세요.</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 섹션 3: 권리화 종합 전략 — 완료 후 fadeIn ── */}
          {report && !loading && report.report?.overall && (
            <div
              className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden"
              style={{ animation: "fadeIn 0.5s ease-out both", animationDelay: `${(report.per_anchor_data.length * 40) + 100}ms` }}
            >
              <div className="bg-[#0f172a] px-6 py-5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 03</p>
                <h2 className="text-xl font-black text-white tracking-tight">권리화 종합 전략</h2>
              </div>

              <div className="p-6 space-y-6">
                {/* 최적 특허 조합 */}
                {(() => {
                  const allAnchorIds = report.per_anchor_data.map(a => a.anchor_id);
                  const anchorNames: Record<string, string> = Object.fromEntries(report.per_anchor_data.map(a => [a.anchor_id, a.anchor_name]));
                  const total = allAnchorIds.length;
                  const anchorBest: Record<string, { pid: string; title: string; score: number }> = {};
                  for (const anchor of report.per_anchor_data) {
                    if (!anchor.top_priors.length) continue;
                    const best = anchor.top_priors.reduce((a, b) => a.similarity > b.similarity ? a : b);
                    anchorBest[anchor.anchor_id] = { pid: best.patent_id, title: best.title || best.patent_id, score: best.similarity };
                  }
                  const patentOrder: string[] = [];
                  const patentToAnchors: Record<string, string[]> = {};
                  const patentTitles: Record<string, string> = {};
                  for (const anchorId of allAnchorIds) {
                    const best = anchorBest[anchorId];
                    if (!best) continue;
                    if (!patentToAnchors[best.pid]) { patentOrder.push(best.pid); patentToAnchors[best.pid] = []; patentTitles[best.pid] = best.title; }
                    patentToAnchors[best.pid].push(anchorId);
                  }
                  const uncovered = allAnchorIds.filter(id => !anchorBest[id]);
                  if (!patentOrder.length) return null;
                  const COLORS = [
                    { bar: "bg-indigo-500",  chip: "bg-indigo-50 text-indigo-600 border-indigo-200",    badge: "bg-indigo-50 border-indigo-200 text-indigo-700"    },
                    { bar: "bg-violet-400",  chip: "bg-violet-50 text-violet-600 border-violet-200",    badge: "bg-violet-50 border-violet-200 text-violet-700"    },
                    { bar: "bg-amber-400",   chip: "bg-amber-50 text-amber-600 border-amber-200",       badge: "bg-amber-50 border-amber-200 text-amber-700"       },
                    { bar: "bg-emerald-400", chip: "bg-emerald-50 text-emerald-600 border-emerald-200", badge: "bg-emerald-50 border-emerald-200 text-emerald-700" },
                    { bar: "bg-rose-400",    chip: "bg-rose-50 text-rose-600 border-rose-200",          badge: "bg-rose-50 border-rose-200 text-rose-700"          },
                  ];
                  return (
                    <div className="border border-slate-100 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">최적 조합</span>
                      </div>
                      <div className="px-5 pt-4">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                          {patentOrder.map((pid, ci) => (
                            <div key={pid} className={`h-full ${COLORS[ci % COLORS.length].bar} transition-all duration-700`} style={{ width: `${(patentToAnchors[pid].length / total) * 100}%` }} />
                          ))}
                        </div>
                      </div>
                      <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
                        {patentOrder.map((pid, ci) => (
                          <React.Fragment key={pid}>
                            {ci > 0 && <span className="text-slate-300 font-black text-sm">+</span>}
                            <span className={`px-3 py-1 rounded-xl border text-xs font-black truncate max-w-[200px] ${COLORS[ci % COLORS.length].badge}`}>
                              {patentTitles[pid]?.slice(0, 22) || pid}
                            </span>
                          </React.Fragment>
                        ))}
                      </div>
                      <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                        {patentOrder.map((pid, ci) => patentToAnchors[pid].map(id => (
                          <span key={`${pid}-${id}`} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${COLORS[ci % COLORS.length].chip}`}>{anchorNames[id]}</span>
                        )))}
                        {uncovered.map(id => (
                          <span key={id} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200">{anchorNames[id]}</span>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="border-t border-slate-100" />

                {report.uncovered_anchors.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-4">
                    <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2">차별화 포인트 (미커버 구성요소)</p>
                    <div className="flex flex-wrap gap-2">
                      {report.uncovered_anchors.map(a => (
                        <span key={a} className="px-3 py-1 rounded-xl bg-emerald-100 text-xs font-black text-emerald-800">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {report.report.overall.patentability_review && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="bg-slate-800 px-5 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">특허성 종합 검토</p>
                    </div>
                    <div className="px-5 py-5 space-y-2">
                      {report.report.overall.patentability_review.split(/(?<=[.!?。])\s+/).map(s => cleanText(s)).filter(Boolean).map((para, i) => (
                        <p key={i} className="text-xs text-slate-600 leading-relaxed">{para}</p>
                      ))}
                    </div>
                  </div>
                )}

                {report.report.overall.filing_strategy && (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden">
                    <div className="bg-slate-800 px-5 py-3">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">특허출원 전략</p>
                    </div>
                    <div className="px-5 py-5 space-y-2">
                      {report.report.overall.filing_strategy.split(/(?<=[.!?。])\s+/).map(s => cleanText(s)).filter(Boolean).map((para, i) => (
                        <p key={i} className="text-xs text-slate-600 leading-relaxed">{para}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pb-10" />
        </div>
      </div>

      {/* Word 변환용 hidden 렌더 (PrintContent와 동일 구조) */}
      {report && prepareData && (
        <div ref={wordContentRef} style={{ position: "absolute", left: "-9999px", top: 0, width: "794px", background: "#fff", padding: "48px", fontFamily: "sans-serif" }}>
          <PrintContent prepareData={prepareData} report={report} cleanText={cleanText} />
        </div>
      )}

    </>
  );
}

function PrintContent({ prepareData, report, cleanText }: {
  prepareData: IdeaPrepareResult;
  report: PriorArtReportResult;
  cleanText: (t: string) => string;
}) {
  const sortedPriors = [...prepareData.prior_patents].sort((a, b) => (b.similarity_score ?? 0) - (a.similarity_score ?? 0));
  const analysisMap: Record<string, any> = {};
  for (const a of report.report?.anchor_analyses ?? []) analysisMap[a.anchor_id] = a;
  const today = new Date().toLocaleDateString("ko-KR");

  return (
    <>
      {/* 커버 */}
      <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "2rem", marginBottom: "2rem" }}>
        <p style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "8px" }}>씽캣 · 선행기술조사보고서</p>
        <h1 style={{ fontSize: "22px", fontWeight: 900, color: "#0f172a", lineHeight: 1.3 }}>{prepareData.refined_title || "선행기술조사보고서"}</h1>
        <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>작성일 {today}</p>
      </div>

      {/* 아이디어 원본 텍스트 */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>아이디어 원본 텍스트</p>
        <p style={{ fontSize: "12px", color: "#334155", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{prepareData.full_text}</p>
      </div>

      {/* Section 01 */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Section 01</p>
        <h2 style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", marginBottom: "16px" }}>유사 선행특허 ({sortedPriors.length}건)</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#94a3b8" }}>
              <th style={{ textAlign: "left", padding: "6px 8px 6px 0", fontWeight: 900, width: "20px" }}>#</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 900 }}>제목</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 900, width: "90px" }}>출원번호</th>
              <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: 900, width: "70px" }}>출원일</th>
              <th style={{ textAlign: "right", padding: "6px 0 6px 8px", fontWeight: 900, width: "50px" }}>유사도</th>
            </tr>
          </thead>
          <tbody>
            {sortedPriors.map((p, i) => (
              <tr key={p.application_number} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td style={{ padding: "6px 8px 6px 0", color: "#94a3b8" }}>{i + 1}</td>
                <td style={{ padding: "6px 8px", color: "#1e293b", fontWeight: 500 }}>{p.title}</td>
                <td style={{ padding: "6px 8px", color: "#64748b" }}>{p.application_number}</td>
                <td style={{ padding: "6px 8px", color: "#64748b" }}>{p.filing_date ?? "-"}</td>
                <td style={{ padding: "6px 0 6px 8px", textAlign: "right", fontWeight: 900, color: "#4f46e5" }}>
                  {p.similarity_score != null ? `${(p.similarity_score * 100).toFixed(1)}%` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Section 02 */}
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Section 02</p>
        <h2 style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", marginBottom: "16px" }}>구성요소별 유사도 분석</h2>
        {report.per_anchor_data.map((anchor) => {
          const analysis = analysisMap[anchor.anchor_id];
          return (
            <div key={anchor.anchor_id} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", marginBottom: "16px", overflow: "hidden" }}>
              <div style={{ background: "#0f172a", padding: "10px 16px" }}>
                <p style={{ fontSize: "12px", fontWeight: 900, color: "#fff", margin: 0 }}>
                  {anchor.anchor_id} · {anchor.anchor_name}
                  <span style={{ color: "#94a3b8", fontWeight: 400, marginLeft: "8px" }}>{anchor.similarity_level}</span>
                </p>
              </div>
              <div>
                {(analysis?.prior_comparisons ?? []).map((comp: any, j: number) => (
                  <div key={j} style={{ padding: "14px 16px", borderTop: j > 0 ? "1px solid #f1f5f9" : "none" }}>
                    <p style={{ fontSize: "12px", fontWeight: 900, color: "#1e293b", marginBottom: "10px" }}>
                      {j + 1}. {comp.patent_title} <span style={{ fontWeight: 400, color: "#94a3b8" }}>({comp.patent_id})</span>
                    </p>
                    <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", marginBottom: "4px" }}>대응 구성요소</p>
                    <p style={{ fontSize: "11px", color: "#334155", marginBottom: "10px" }}>{comp.matched_element}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: 900, color: "#f43f5e", textTransform: "uppercase", marginBottom: "4px" }}>유사성</p>
                        <p style={{ fontSize: "11px", color: "#334155", lineHeight: 1.6 }}>{comp.similarity}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: "10px", fontWeight: 900, color: "#4f46e5", textTransform: "uppercase", marginBottom: "4px" }}>회피 전략</p>
                        <p style={{ fontSize: "11px", color: "#334155", lineHeight: 1.6 }}>{comp.avoidance_direction}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {report.uncovered_anchors.includes(anchor.anchor_name) && (
                  <div style={{ padding: "12px 16px", background: "#f0fdf4" }}>
                    <p style={{ fontSize: "11px", color: "#166534", fontWeight: 700, margin: 0 }}>차별화 가능 구성요소 — 유사 선행발명 없음</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 03 */}
      <div>
        <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>Section 03</p>
        <h2 style={{ fontSize: "15px", fontWeight: 900, color: "#0f172a", marginBottom: "16px" }}>권리화 종합 전략</h2>

        {/* 최적 조합 */}
        {(() => {
          const anchorNames: Record<string, string> = Object.fromEntries(report.per_anchor_data.map(a => [a.anchor_id, a.anchor_name]));
          const anchorBest: Record<string, { pid: string; title: string }> = {};
          for (const anchor of report.per_anchor_data) {
            if (!anchor.top_priors.length) continue;
            const best = anchor.top_priors.reduce((a, b) => a.similarity > b.similarity ? a : b);
            anchorBest[anchor.anchor_id] = { pid: best.patent_id, title: best.title || best.patent_id };
          }
          const patentOrder: string[] = [];
          const patentToAnchors: Record<string, string[]> = {};
          const patentTitles: Record<string, string> = {};
          for (const anchor of report.per_anchor_data) {
            const best = anchorBest[anchor.anchor_id];
            if (!best) continue;
            if (!patentToAnchors[best.pid]) { patentOrder.push(best.pid); patentToAnchors[best.pid] = []; patentTitles[best.pid] = best.title; }
            patentToAnchors[best.pid].push(anchor.anchor_id);
          }
          if (!patentOrder.length) return null;
          return (
            <div style={{ marginBottom: "16px", padding: "14px 16px", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
              <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", marginBottom: "10px" }}>최적 조합</p>
              <p style={{ fontSize: "13px", fontWeight: 900, color: "#0f172a", marginBottom: "8px" }}>
                {patentOrder.map((pid, i) => (
                  <span key={pid}>{i > 0 && <span style={{ color: "#94a3b8", margin: "0 6px" }}>+</span>}{patentTitles[pid]?.slice(0, 20) || pid}</span>
                ))}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {patentOrder.map(pid =>
                  patentToAnchors[pid].map(id => (
                    <span key={`${pid}-${id}`} style={{ fontSize: "10px", padding: "3px 10px", borderRadius: "999px", border: "1px solid #e2e8f0", color: "#475569", background: "#f8fafc" }}>
                      {anchorNames[id]}
                    </span>
                  ))
                )}
              </div>
            </div>
          );
        })()}

        {report.report.overall?.patentability_review && (
          <div style={{ marginBottom: "16px" }}>
            <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>특허성 종합 검토</p>
            <p style={{ fontSize: "12px", color: "#334155", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{cleanText(report.report.overall.patentability_review)}</p>
          </div>
        )}
        {report.report.overall?.filing_strategy && (
          <div>
            <p style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px" }}>특허출원 전략</p>
            <p style={{ fontSize: "12px", color: "#334155", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{cleanText(report.report.overall.filing_strategy)}</p>
          </div>
        )}
      </div>
    </>
  );
}
