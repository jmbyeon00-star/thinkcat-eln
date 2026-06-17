'use client';

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "@/routing";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import PageShell from "@/components/layouts/PageShell";
import {
    invalGetAnalysisStatus,
    invalPrepareFromPdf,
    invalPrepareFromText,
    invalGetIdeaHistoryList,
    invalGetIdeaHistoryDetail,
    invalDeleteIdeaHistory,
    invalRefreshIdeaHistory,
    InvalPatentSearchResult,
    InvalAnalysisStatusResult,
    IdeaHistoryItem,
} from "@/lib/invalidation_api";
import { AlertCircle, ArrowLeft, ExternalLink, Upload, FileText, X, ArrowUp, Trash2, Clock, RefreshCw } from "lucide-react";


export default function InvalidationHome() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const token = (session as any)?.access_token as string | undefined;

    const [query, setQuery] = useState("");
    const [searching, setSearching] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [searchResults, setSearchResults] = useState<InvalPatentSearchResult[]>([]);
    const [selectedPatent, setSelectedPatent] = useState<InvalPatentSearchResult | null>(null);
    const [statusResult, setStatusResult] = useState<InvalAnalysisStatusResult | null>(null);
    const [notFound, setNotFound] = useState(false);
    const model = "claude";
    const [totalResults, setTotalResults] = useState(0);

    const [pdfUploadActive, setPdfUploadActive] = useState(false);
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [pdfSearching, setPdfSearching] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [history, setHistory] = useState<IdeaHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [refreshingId, setRefreshingId] = useState<number | null>(null);
    const [refreshMsg, setRefreshMsg] = useState<string | null>(null);
    const [historyHasMore, setHistoryHasMore] = useState(false);
    const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
    const HISTORY_PAGE = 3;

    useEffect(() => {
        if (!token) return;
        setHistoryLoading(true);
        invalGetIdeaHistoryList(token, 0, HISTORY_PAGE)
            .then(items => {
                setHistory(items);
                setHistoryHasMore(items.length === HISTORY_PAGE);
            })
            .catch(() => setHistory([]))
            .finally(() => setHistoryLoading(false));
    }, [token]);

    const handleLoadMoreHistory = async () => {
        if (!token || historyLoadingMore) return;
        setHistoryLoadingMore(true);
        try {
            const more = await invalGetIdeaHistoryList(token, history.length, HISTORY_PAGE);
            setHistory(prev => [...prev, ...more]);
            setHistoryHasMore(more.length === HISTORY_PAGE);
        } catch (e) {
            console.error(e);
        } finally {
            setHistoryLoadingMore(false);
        }
    };

    const handleHistoryClick = async (item: IdeaHistoryItem) => {
        if (!token) return;
        try {
            const detail = await invalGetIdeaHistoryDetail(token, item.id);
            if (!detail.report) return;
            const cacheKey = `priorArtReport_${detail.report.base_id}_${detail.model}`;
            sessionStorage.setItem(cacheKey, JSON.stringify(detail.report));
            sessionStorage.setItem("ideaPrepareData", JSON.stringify({
                idea_uuid:         detail.report.idea_uuid ?? "",
                base_id:           detail.report.base_id,
                full_text:         detail.report.full_text ?? "",
                refined_title:     item.idea_title,
                raw_text:          "",
                prior_patents:     detail.prior_patents ?? Object.values(detail.report.prior_infos ?? {}),
                prior_app_numbers: item.prior_app_numbers,
            }));
            router.push("/prior-art/report");
        } catch (e) {
            console.error(e);
        }
    };

    const handleRefreshHistory = async (e: React.MouseEvent, item: IdeaHistoryItem) => {
        e.stopPropagation();
        if (!token) return;
        setRefreshingId(item.id);
        setRefreshMsg(null);
        try {
            const res = await invalRefreshIdeaHistory(token, item.id);
            if (!res.changed) {
                setRefreshMsg("변경된 사항이 없습니다.");
                setTimeout(() => setRefreshMsg(null), 3000);
            } else if (res.result) {
                const cacheKey = `priorArtReport_${res.result.base_id}_${item.model}`;
                sessionStorage.setItem(cacheKey, JSON.stringify(res.result));
                sessionStorage.setItem("ideaPrepareData", JSON.stringify({
                    idea_uuid:         res.result.idea_uuid ?? "",
                    base_id:           res.result.base_id,
                    full_text:         res.result.full_text ?? "",
                    refined_title:     item.idea_title,
                    raw_text:          "",
                    prior_patents:     Object.values(res.result.prior_infos ?? {}),
                    prior_app_numbers: (res.result.related_patents ?? []).map((p: any) => p.patent_id),
                }));
                router.push("/prior-art/report");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setRefreshingId(null);
        }
    };

    const handleDeleteHistory = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!token) return;
        setDeletingId(id);
        try {
            await invalDeleteIdeaHistory(token, id);
            setHistory(prev => prev.filter(h => h.id !== id));
        } catch (e) {
            console.error(e);
        } finally {
            setDeletingId(null);
        }
    };

    useEffect(() => {
        const base = searchParams.get("base") ?? undefined;
        const qmodel = searchParams.get("model") ?? "claude";
        if (base) {
            const fakePatent: InvalPatentSearchResult = {
                application_number: base, title: base,
                filing_date: null, applicant_name: null, inventor_name: null,
                ipc_code: null, abstract: null, end_status: null, similarity_score: null,
            };
            handleSelectPatent(fakePatent, [], qmodel);
        }
    }, [searchParams]);

    const isAppNumber = (q: string) => /^\d+$/.test(q.trim());

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        setNotFound(false);
        setSelectedPatent(null);
        setStatusResult(null);
        setSearchResults([]);
        setTotalResults(0);
        setPdfFile(null);
        setPdfUploadActive(false);
        setPdfError(null);

        try {
            if (isAppNumber(query)) {
                const fakePatent: InvalPatentSearchResult = {
                    application_number: query.trim(), title: query.trim(),
                    filing_date: null, applicant_name: null, inventor_name: null,
                    ipc_code: null, abstract: null, end_status: null, similarity_score: null,
                };
                setSearching(false);
                await handleSelectPatent(fakePatent, [], model);
            } else {
                // 아이디어 텍스트 → prepare → 분석 페이지로 이동
                setSearching(false);
                setPdfSearching(true);
                try {
                    const result = await invalPrepareFromText(query.trim(), "ALL", 15);
                    sessionStorage.setItem("ideaPrepareData", JSON.stringify(result));
                    router.push(`/prior-art/report`);
                } catch (e: any) {
                    setNotFound(true);
                    console.error(e);
                } finally {
                    setPdfSearching(false);
                }
            }
        } catch (e) {
            console.error(e);
            setNotFound(true);
        } finally {
            setSearching(false);
        }
    };

    const handleSelectPatent = async (patent: InvalPatentSearchResult, prevResults: InvalPatentSearchResult[], patentModel?: string) => {
        setSelectedPatent(patent);
        setLoadingStatus(true);
        setStatusResult(null);
        try {
            const status = await invalGetAnalysisStatus(patent.application_number, patentModel ?? model);
            if (status.base) setSelectedPatent(status.base);
            setStatusResult(status);
        } catch (e) {
            console.error(e);
            setNotFound(true);
            setSelectedPatent(null);
            setSearchResults(prevResults);
        } finally {
            setLoadingStatus(false);
        }
    };

    const handleAnalyze = () => {
        if (!selectedPatent) return;
        router.push(
            `/prior-art/analysis?base=${encodeURIComponent(selectedPatent.application_number)}&cached=${statusResult?.cached ?? false}&model=${model}`
        );
    };

    const canAnalyze = !loadingStatus && statusResult != null && !statusResult.unavailable && statusResult.priors.length > 0;

    const handleFileSelect = (file: File) => {
        if (!file || file.type !== "application/pdf") return;
        setPdfFile(file);
        setPdfError(null);
        setSearchResults([]);
        setTotalResults(0);
        setNotFound(false);
        setSelectedPatent(null);
        setStatusResult(null);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    };

    const handlePdfSearch = async () => {
        if (!pdfFile) return;
        setPdfSearching(true);
        setPdfError(null);
        setSearchResults([]);
        setTotalResults(0);
        setNotFound(false);
        try {
            const result = await invalPrepareFromPdf(pdfFile, "ALL", 15);
            sessionStorage.setItem("ideaPrepareData", JSON.stringify(result));
            router.push(`/prior-art/report`);
        } catch (e: any) {
            setPdfError(e?.message ?? "선행발명 검색 중 오류가 발생했습니다");
        } finally {
            setPdfSearching(false);
        }
    };

    const resetPdf = () => {
        setPdfFile(null);
        setPdfError(null);
        setSearchResults([]);
        setTotalResults(0);
        setNotFound(false);
        setPdfUploadActive(false);
    };

    const hasContent = pdfUploadActive || pdfFile || searchResults.length > 0 || notFound || selectedPatent;

    return (
        <>
            {refreshMsg && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 bg-slate-800 text-white text-sm rounded-2xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {refreshMsg}
                </div>
            )}
            <PageShell
                title="선행기술조사"
                description="특허 출원·분쟁 이전 단계에서 기술적 차별성과 권리 확보 가능성을 사전에 검증합니다"
            >

                {/* 입력 영역 (중앙 정렬) */}
                <div className={`px-8 text-center flex flex-col items-center justify-center transition-all duration-500 ${hasContent ? "py-4" : "py-16"}`}>

                    {/* 히어로 헤더 (입력 전에만 크게 표시) */}
                    {!hasContent && (
                        <div className="text-center mb-8 animate-in fade-in zoom-in duration-1000">
                            <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-5 leading-tight">
                                어떤 기술을 <span className="text-indigo-600">조사하시나요?</span>
                            </h1>
                            <p className="text-slate-500 text-lg font-medium">
                                출원 전 유사 선행특허를 찾아 기술 차별성과 권리 확보 가능성을 검증합니다.
                            </p>
                        </div>
                    )}

                    <div className="w-full max-w-2xl flex flex-col gap-3">

                        {/* PDF 드랍존 */}
                        {pdfUploadActive && !pdfFile && (
                            <div
                                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`rounded-3xl border-2 border-dashed px-8 py-14 flex flex-col items-center gap-4 cursor-pointer transition-all duration-200 ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-indigo-200 bg-white hover:border-indigo-400 hover:bg-indigo-50/50"}`}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }}
                                />
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                                    <Upload size={24} className="text-indigo-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-slate-700">PDF 파일을 드래그하거나 클릭해서 업로드하세요</p>
                                    <p className="text-xs text-slate-400 mt-1">출원 전 특허 명세서도 분석 가능합니다</p>
                                </div>
                                <button
                                    onClick={e => { e.stopPropagation(); setPdfUploadActive(false); }}
                                    className="mt-1 text-xs text-slate-400 hover:text-slate-600 font-bold"
                                >
                                    취소
                                </button>
                            </div>
                        )}

                        {/* 파일 선택됨 */}
                        {pdfFile && (
                            <div className="rounded-3xl border border-indigo-100 bg-white shadow-xl shadow-zinc-200/60 px-6 py-5 flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                                            <FileText size={18} className="text-indigo-500" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 truncate max-w-xs">{pdfFile.name}</p>
                                            <p className="text-xs text-slate-400">{(pdfFile.size / 1024).toFixed(1)} KB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={resetPdf}
                                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-rose-500 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                                {pdfError && (
                                    <p className="text-xs font-bold text-rose-500 text-center">{pdfError}</p>
                                )}
                                <button
                                    onClick={handlePdfSearch}
                                    disabled={pdfSearching}
                                    className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                                >
                                    {pdfSearching ? "선행기술 조사 중..." : "선행기술 조사 시작"}
                                </button>
                            </div>
                        )}

                        {/* 키워드 검색창 (PDF 모드 아닐 때) */}
                        {!pdfUploadActive && !pdfFile && (
                            <>
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => setPdfUploadActive(true)}
                                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl border border-indigo-200 text-indigo-600 text-xs font-bold hover:bg-indigo-50 hover:border-indigo-400 transition-all"
                                    >
                                        <img src="/images/pdf-logo.png" width={20} height={20} alt="PDF" />
                                        PDF 업로드
                                    </button>
                                </div>
                                <div className="bg-[#f0f4f9] rounded-[32px] p-2 shadow-2xl flex flex-col transition-all border border-transparent focus-within:bg-white focus-within:border-slate-200">
                                    <textarea
                                        rows={3}
                                        value={query}
                                        onChange={e => setQuery(e.target.value)}
                                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSearch(); } }}
                                        placeholder="출원번호 입력, 아이디어 작성, 또는 연구노트 PDF 업로드 중 원하는 방식으로 선행기술조사를 시작하세요"
                                        className="bg-transparent border-none outline-none text-slate-800 text-[17px] font-medium placeholder:text-slate-400 w-full resize-none pt-3 px-4 pb-2"
                                    />
                                    <div className="flex items-center justify-end px-2 pb-1">
                                        <button
                                            onClick={handleSearch}
                                            disabled={searching || loadingStatus || !query.trim()}
                                            className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${query.trim() && !searching && !loadingStatus ? "bg-indigo-600 text-white shadow-lg" : "text-slate-300 bg-transparent"}`}
                                        >
                                            {searching || loadingStatus
                                                ? <span className="animate-spin text-sm font-bold text-indigo-400">✦</span>
                                                : <ArrowUp size={20} strokeWidth={3} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 결과 영역 */}
                <div className="max-w-3xl mx-auto px-8 py-12">

                    {/* 최근 조사 내역 (검색 전 상태에서만 표시) */}
                    {!hasContent && token && (historyLoading || history.length > 0) && (
                        <div className="mb-12 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between px-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock size={15} className="text-slate-400" />
                                    <h2 className="text-sm font-black text-slate-500 uppercase tracking-wider">최근 조사 내역</h2>
                                </div>
                            </div>

                            {historyLoading ? (
                                <div className="space-y-3">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((item) => (
                                        <div
                                            key={item.id}
                                            onClick={() => handleHistoryClick(item)}
                                            className="group flex items-center gap-4 px-5 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 hover:-translate-y-0.5 transition-all cursor-pointer"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />

                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {item.idea_title || "제목 없음"}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">
                                                    선행특허 {item.prior_app_numbers.length}건 · {item.created_at ? new Date(item.created_at).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" }) : ""}
                                                </p>
                                            </div>

                                            <div className={`flex items-center gap-1 transition-all ${refreshingId === item.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                                <button
                                                    onClick={(e) => handleRefreshHistory(e, item)}
                                                    disabled={refreshingId === item.id}
                                                    title="재생성"
                                                    className={`p-2 rounded-xl transition-all ${refreshingId === item.id ? "text-indigo-500 bg-indigo-50" : "text-slate-300 hover:text-indigo-500 hover:bg-indigo-50"}`}
                                                >
                                                    <RefreshCw size={14} className={refreshingId === item.id ? "animate-spin text-indigo-500" : ""} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteHistory(e, item.id)}
                                                    disabled={deletingId === item.id}
                                                    title="삭제"
                                                    className="p-2 rounded-xl text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-40"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                    {historyHasMore && (
                                        <button
                                            onClick={handleLoadMoreHistory}
                                            disabled={historyLoadingMore}
                                            className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-40"
                                        >
                                            {historyLoadingMore ? "불러오는 중..." : "더보기"}
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* 분석 로딩 (PDF 또는 아이디어 텍스트) */}
                    {pdfSearching && (
                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                            <div className="relative w-12 h-12">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-100/50"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin shadow-lg"></div>
                            </div>
                            <p className="text-sm font-bold text-slate-400 animate-pulse">
                                {pdfFile ? "PDF에서 선행기술 분석 중..." : "아이디어 선행기술 분석 중..."}
                            </p>
                            <p className="text-xs text-slate-300">구성요소 추출 및 선행발명 비교에 1~3분이 소요됩니다</p>
                        </div>
                    )}

                    {/* 검색 결과 목록 */}
                    {!selectedPatent && !pdfSearching && searchResults.length > 0 && (
                        <div className="space-y-6 animate-in fade-in zoom-in duration-700">
                            <div className="flex flex-col gap-1 px-2">
                                <h2 className="text-2xl font-black text-slate-900">
                                    검색 결과{" "}
                                    <span className="text-indigo-600">{totalResults.toLocaleString()}</span>
                                </h2>
                            </div>

                            <div className="space-y-4">
                                {searchResults.map(p => {
                                    const status = p.end_status ?? "등록";
                                    return (
                                        <div
                                            key={p.application_number}
                                            onClick={() => handleSelectPatent(p, searchResults)}
                                            className="group p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-200 hover:shadow-indigo-100/50 transition-all cursor-pointer relative overflow-hidden text-left"
                                        >
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all">
                                                <button
                                                    onClick={e => { e.stopPropagation(); router.push(`/applicationNum/${p.application_number}`); }}
                                                    className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-indigo-600 hover:text-white transition-all"
                                                    title="상세 페이지로 이동"
                                                >
                                                    <ExternalLink size={18} />
                                                </button>
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${status === "등록" ? "bg-green-100 text-green-700" : status === "거절" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                                                        {status}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400">#{p.application_number}</span>
                                                </div>
                                                <h3 className="text-lg font-bold leading-snug text-slate-900 group-hover:text-indigo-700 transition-colors line-clamp-2">
                                                    {p.title}
                                                </h3>
                                                <div className="grid grid-cols-3 gap-4 mt-2 pt-4 border-t border-slate-50 text-sm">
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-[10px] uppercase tracking-wider">출원일</p>
                                                        <p className="font-semibold text-slate-700">{p.filing_date ?? "정보 없음"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-[10px] uppercase tracking-wider">IPC 분류</p>
                                                        <p className="font-mono text-[10px] text-blue-600 font-bold bg-blue-50/50 px-1.5 py-0.5 rounded-md border border-blue-100/50 truncate">{p.ipc_code ?? "정보 없음"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-[10px] uppercase tracking-wider">출원인</p>
                                                        <p className="font-semibold text-slate-700">{p.applicant_name ?? "정보 없음"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 결과 없음 */}
                    {notFound && !pdfSearching && !searching && (
                        <div className="text-center py-20 text-slate-400 font-bold">
                            {pdfFile ? "유사한 선행발명을 찾을 수 없습니다." : "출원번호를 입력해주세요. (숫자만 입력 가능)"}
                        </div>
                    )}

                    {/* 선택된 특허 */}
                    {selectedPatent && (
                        <div className="animate-in fade-in zoom-in duration-700">
                            <div className="flex items-center justify-start mb-5">
                                <button
                                    onClick={() => { setSelectedPatent(null); setStatusResult(null); setNotFound(false); }}
                                    className="group flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
                                >
                                    <div className="p-1.5 rounded-full bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 transition-colors">
                                        <ArrowLeft size={18} strokeWidth={3} />
                                    </div>
                                    <span className="text-sm font-black text-slate-600 group-hover:text-blue-700">이전결과로 돌아가기</span>
                                </button>
                            </div>

                            <div className="px-2 mb-6">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">분석 대상 특허</p>
                                <h2 className="text-xl font-black text-slate-900 leading-snug">{selectedPatent.title}</h2>
                                <p className="text-xs font-bold text-slate-400 mt-1">
                                    {selectedPatent.application_number}
                                    {selectedPatent.filing_date && <span> · {selectedPatent.filing_date}</span>}
                                </p>
                            </div>

                            {!loadingStatus && statusResult?.unavailable && (
                                <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100 flex gap-4 items-start mb-8">
                                    <div className="bg-rose-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-100">
                                        <AlertCircle size={20} />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-rose-900 uppercase">무효화 분석 불가</h4>
                                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                            등록 또는 공개 상태인 특허만 무효화 분석이 가능합니다.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {!statusResult?.unavailable && (
                                <div>
                                    <div className="flex items-center justify-between px-2 mb-6">
                                        <h2 className="text-2xl font-black text-slate-900">
                                            비교 선행발명
                                            {!loadingStatus && statusResult && statusResult.priors.length > 0 && (
                                                <span className="text-indigo-600 ml-2">{statusResult.priors.length}</span>
                                            )}
                                        </h2>
                                        {!loadingStatus && statusResult && !statusResult.unavailable && (
                                            <button
                                                onClick={handleAnalyze}
                                                disabled={!canAnalyze}
                                                className="group flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <span className="text-sm font-black text-slate-600 group-hover:text-indigo-700">무효화 가능성 분석</span>
                                                <div className="p-1.5 rounded-full bg-slate-50 group-hover:bg-indigo-50 text-slate-400 group-hover:text-indigo-600 transition-colors">
                                                    <ArrowLeft size={18} strokeWidth={3} className="rotate-180" />
                                                </div>
                                            </button>
                                        )}
                                    </div>

                                    {loadingStatus && (
                                        <div className="flex flex-col items-center justify-center gap-4 py-20">
                                            <div className="relative w-12 h-12">
                                                <div className="absolute inset-0 rounded-full border-4 border-slate-100/50"></div>
                                                <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin shadow-lg"></div>
                                            </div>
                                            <p className="text-sm font-bold text-slate-400 animate-pulse">선행발명 검색 중...</p>
                                        </div>
                                    )}

                                    {!loadingStatus && statusResult && !statusResult.unavailable && statusResult.priors.length > 0 && (
                                        <div className="space-y-2">
                                            {statusResult.priors.map((p, i) => (
                                                <div
                                                    key={p.application_number}
                                                    className="flex items-center gap-4 px-5 py-3.5 bg-white border border-slate-100 rounded-2xl shadow-sm animate-in fade-in slide-in-from-bottom-1 duration-300"
                                                    style={{ animationDelay: `${i * 0.05}s`, animationFillMode: "both" }}
                                                >
                                                    {/* 순번 */}
                                                    <span className="text-[11px] font-black text-slate-300 w-5 shrink-0 text-center">{i + 1}</span>

                                                    {/* 특허 정보 */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[10px] font-bold text-slate-400 mb-0.5">{p.application_number}</p>
                                                        <p className="text-sm font-bold text-slate-900 truncate">{p.title}</p>
                                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                                            {p.filing_date ?? "—"} · {p.applicant_name ?? "—"}
                                                        </p>
                                                    </div>

                                                    {/* 유사도 뱃지 */}
                                                    {p.similarity_score != null && (
                                                        <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-black border"
                                                            style={{
                                                                background: p.similarity_score >= 0.85 ? "#fef2f2" : p.similarity_score >= 0.7 ? "#fffbeb" : "#f8fafc",
                                                                color:      p.similarity_score >= 0.85 ? "#dc2626"  : p.similarity_score >= 0.7 ? "#d97706"  : "#64748b",
                                                                borderColor:p.similarity_score >= 0.85 ? "#fecaca"  : p.similarity_score >= 0.7 ? "#fde68a"  : "#e2e8f0",
                                                            }}
                                                        >
                                                            {(p.similarity_score * 100).toFixed(1)}%
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {!loadingStatus && statusResult && !statusResult.unavailable && statusResult.priors.length === 0 && (
                                        <div className="text-center py-20 text-slate-400 font-bold">선행발명이 없습니다</div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </PageShell>
        </>
    );
}
