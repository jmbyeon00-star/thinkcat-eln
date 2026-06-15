'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "@/routing";
import { useSession } from "next-auth/react";
import { ArrowLeft, ChevronDown, ChevronUp, ExternalLink, AlertCircle, Download, X } from "lucide-react";
import {
  invalGeneratePriorArtReport,
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
  const [report, setReport] = useState<PriorArtReportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openAnchorId, setOpenAnchorId] = useState<string | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const model = "claude";

  useEffect(() => {
    const raw = sessionStorage.getItem("ideaPrepareData");
    if (!raw) { router.replace("/prior-art"); return; }
    const data: IdeaPrepareResult = JSON.parse(raw);
    setPrepareData(data);

    const cacheKey = `priorArtReport_${data.base_id}_${model}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) { setReport(JSON.parse(cached)); return; }

    setLoading(true);
    invalGeneratePriorArtReport({
      idea_uuid:         data.idea_uuid,
      base_id:           data.base_id,
      raw_text:          data.raw_text,
      full_text:         data.full_text,
      prior_app_numbers: data.prior_app_numbers,
      idea_title:        data.refined_title ?? "",
      model,
      token,
    })
      .then(result => {
        setReport(result);
        sessionStorage.setItem(cacheKey, JSON.stringify(result));
      })
      .catch(e => setError(e?.message ?? "보고서 생성 중 오류가 발생했습니다"))
      .finally(() => setLoading(false));
  }, [token]);

  const analysisMap: Record<string, PriorArtAnchorAnalysis> = {};
  if (report?.report?.anchor_analyses) {
    for (const a of report.report.anchor_analyses) analysisMap[a.anchor_id] = a;
  }

  return (
    <>
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
                onClick={() => setShowPrint(true)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-xs font-black rounded-2xl hover:bg-slate-700 transition-all"
              >
                <Download size={13} />
                PDF 저장
              </button>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

          {/* 로딩 */}
          {loading && (
            <div className="flex flex-col items-center justify-center gap-6 py-32">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 animate-spin" />
              </div>
              <div className="text-center">
                <p className="text-base font-black text-slate-700 animate-pulse">보고서 생성 중...</p>
                <p className="text-sm text-slate-400 mt-2">선행발명 파싱 및 AI 분석에 3~5분이 소요됩니다</p>
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

          {!loading && !error && prepareData && (
            <>
              {/* ── 섹션 1: 유사 선행 특허 ── */}
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
                    {[...prepareData.prior_patents].sort((a, b) => (b.similarity_score ?? 0) - (a.similarity_score ?? 0)).map((p, i) => (
                      <button
                        key={p.application_number}
                        onClick={() => router.push(`/applicationNum/${p.application_number}`)}
                        className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
                      >
                        {/* 순번 */}
                        <span className="text-[11px] font-black text-slate-300 w-4 shrink-0 text-center">{i + 1}</span>

                        {/* 특허 정보 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors leading-snug">
                            {p.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {p.application_number}{p.filing_date ? ` · ${p.filing_date}` : ""}{p.applicant_name ? ` · ${p.applicant_name}` : ""}
                          </p>
                        </div>

                        {/* 유사도 뱃지 */}
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

              {/* ── 섹션 2: 구성요소 종합 검토 ── */}
              <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#0f172a] px-6 py-5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 02</p>
                  <h2 className="text-xl font-black text-white tracking-tight">구성요소 종합 검토</h2>
                </div>

                {!report && (
                  <div className="px-6 py-10 text-center text-slate-400 text-sm font-bold">
                    {loading ? "분석 중..." : "보고서 생성 후 표시됩니다"}
                  </div>
                )}

                {report && (
                  <div className="divide-y divide-slate-50">
                    {report.per_anchor_data.map((anchor) => {
                      const isOpen = openAnchorId === anchor.anchor_id;
                      const analysis = analysisMap[anchor.anchor_id];
                      const sim = SIM_BADGE[anchor.similarity_level] ?? SIM_BADGE["보통"];

                      return (
                        <div key={anchor.anchor_id}>
                          {/* 앵커 헤더 */}
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

                          {/* 앵커 상세 */}
                          {isOpen && (
                            <div className="bg-slate-50/50 border-t border-slate-100 px-6 py-6 space-y-5">

                              {(analysis?.prior_comparisons ?? []).map((comp, j) => (
                                <div key={comp.patent_id} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                                  {/* 특허 헤더 */}
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
                                    {/* 매칭 구성요소 */}
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

                                    {/* 작동 방식 */}
                                    <div className="bg-slate-50 rounded-xl px-4 py-3">
                                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">작동 방식</p>
                                      <p className="text-xs text-slate-700 leading-relaxed">{comp.operation}</p>
                                    </div>

                                    {/* 유사성 + 회피 전략 */}
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

                              {/* 미커버 앵커 */}
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

              {/* ── 섹션 3: 권리화 종합 전략 ── */}
              <div className="bg-white rounded-[1.5rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="bg-[#0f172a] px-6 py-5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Section 03</p>
                  <h2 className="text-xl font-black text-white tracking-tight">권리화 종합 전략</h2>
                </div>

                {!report && (
                  <div className="px-6 py-10 text-center text-slate-400 text-sm font-bold">
                    보고서 생성 후 표시됩니다
                  </div>
                )}

                {report?.report?.overall && (
                  <div className="p-6 space-y-6">

                    {/* ── 최적 특허 조합 (구성요소별 최고 유사도 특허 기준) ── */}
                    {(() => {
                      const allAnchorIds = report.per_anchor_data.map(a => a.anchor_id);
                      const anchorNames: Record<string, string> = Object.fromEntries(
                        report.per_anchor_data.map(a => [a.anchor_id, a.anchor_name])
                      );
                      const total = allAnchorIds.length;

                      // 각 구성요소별 최고 유사도 특허
                      const anchorBest: Record<string, { pid: string; title: string; score: number }> = {};
                      for (const anchor of report.per_anchor_data) {
                        if (anchor.top_priors.length === 0) continue;
                        const best = anchor.top_priors.reduce((a, b) => a.similarity > b.similarity ? a : b);
                        anchorBest[anchor.anchor_id] = { pid: best.patent_id, title: best.title || best.patent_id, score: best.similarity };
                      }

                      // 특허별 담당 구성요소 묶기
                      const patentOrder: string[] = [];
                      const patentToAnchors: Record<string, string[]> = {};
                      const patentTitles: Record<string, string> = {};
                      for (const anchorId of allAnchorIds) {
                        const best = anchorBest[anchorId];
                        if (!best) continue;
                        if (!patentToAnchors[best.pid]) {
                          patentOrder.push(best.pid);
                          patentToAnchors[best.pid] = [];
                          patentTitles[best.pid] = best.title;
                        }
                        patentToAnchors[best.pid].push(anchorId);
                      }

                      const uncovered = allAnchorIds.filter(id => !anchorBest[id]);
                      const covPct = Math.round(((total - uncovered.length) / total) * 100);

                      if (patentOrder.length === 0) return null;

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
                          {/* 스택 프로그레스바 */}
                          <div className="px-5 pt-4">
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                              {patentOrder.map((pid, ci) => (
                                <div
                                  key={pid}
                                  className={`h-full ${COLORS[ci % COLORS.length].bar} transition-all duration-700`}
                                  style={{ width: `${(patentToAnchors[pid].length / total) * 100}%` }}
                                />
                              ))}
                            </div>
                          </div>
                          {/* 특허 badges */}
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
                          {/* 구성요소 칩 */}
                          <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                            {patentOrder.map((pid, ci) =>
                              patentToAnchors[pid].map(id => (
                                <span key={`${pid}-${id}`} className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${COLORS[ci % COLORS.length].chip}`}>
                                  {anchorNames[id]}
                                </span>
                              ))
                            )}
                            {uncovered.map(id => (
                              <span key={id} className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-200">
                                {anchorNames[id]}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="border-t border-slate-100" />

                    {/* 미커버 앵커 */}
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

                    {/* 특허성 종합 검토 */}
                    {report.report.overall.patentability_review && (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden">
                        <div className="bg-slate-800 px-5 py-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">특허성 종합 검토</p>
                        </div>
                        <div className="px-5 py-5 space-y-2">
                          {report.report.overall.patentability_review
                            .split(/(?<=[.!?。])\s+/)
                            .map(s => cleanText(s))
                            .filter(Boolean)
                            .map((para, i) => (
                              <p key={i} className="text-xs text-slate-600 leading-relaxed">{para}</p>
                            ))}
                        </div>
                      </div>
                    )}

                    {/* 특허출원 전략 */}
                    {report.report.overall.filing_strategy && (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden">
                        <div className="bg-slate-800 px-5 py-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">특허출원 전략</p>
                        </div>
                        <div className="px-5 py-5 space-y-2">
                          {report.report.overall.filing_strategy
                            .split(/(?<=[.!?。])\s+/)
                            .map(s => cleanText(s))
                            .filter(Boolean)
                            .map((para, i) => (
                              <p key={i} className="text-xs text-slate-600 leading-relaxed">{para}</p>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pb-10" />
            </>
          )}
        </div>
      </div>

      {/* 미리보기 모달 */}
      {showPrint && report && prepareData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col">
          {/* 상단 바 */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shrink-0">
            <span className="text-sm font-black text-slate-700">미리보기</span>
            <button onClick={() => setShowPrint(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 transition-all">
              <X size={16} />
            </button>
          </div>
          {/* 미리보기 스크롤 영역 */}
          <div className="flex-1 overflow-y-auto bg-slate-300 py-8">
            <div id="pdf-preview-content" className="max-w-3xl mx-auto bg-white shadow-xl p-12 space-y-10" style={{ fontFamily: "sans-serif" }}>
              <PrintContent prepareData={prepareData} report={report} cleanText={cleanText} />
            </div>
          </div>
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
