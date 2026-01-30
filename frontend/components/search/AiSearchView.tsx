import React, { useEffect, useRef } from 'react';
import { useSession } from "next-auth/react";
import { Database, Filter, Search } from 'lucide-react';
import { AiSearchGuide } from "./AiSearchGuide";
import { FixedChatBar } from "./FixedChatBar";
import { SearchOptions, SearchResultItem } from '@/types/search';

interface AiSearchViewProps {
    currentPage: number;
    searchMode: string;
    setSearchMode: (m: "chat" | "keyword") => void;
    query: string;
    setQuery: (q: string) => void;
    options: SearchOptions;
    setOptions: React.Dispatch<React.SetStateAction<SearchOptions>>;
    isLoading: boolean;
    setIsLoading: (b: boolean) => void;
    results: SearchResultItem[];
    setResults: (r: SearchResultItem[]) => void;
    setTotalHits: (n: number) => void;
    setHasSearched: (b: boolean) => void;
    setTargetKeyword: (k: string) => void;
    targetKeyword: string;
    hasSearched: boolean;
}

export const AiSearchView = (props: AiSearchViewProps) => {
    const lastPageRef = useRef<number | null>(null);

    const { data: session } = useSession();
    const token = session?.access_token;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const inputClassName = "w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-700 placeholder:text-slate-300 text-sm";

    // 헬퍼: 연도 데이터 정규화
    const normalizeYear = (yearData: any) => {
        if (!yearData) return { gte: undefined, lte: undefined };
        if (typeof yearData === 'number') return { gte: yearData, lte: yearData };
        return {
            gte: yearData.gte ?? yearData.from ?? undefined,
            lte: yearData.lte ?? yearData.to ?? undefined,
        };
    };

    // 🚀 [로직 1] 최초 AI 의도 검색 (MCP API)
    const handleAISearch = async (page: number = 1) => {
        if (!props.query.trim()) return;

        props.setIsLoading(true);
        props.setHasSearched(true);
        props.setSearchMode("chat")

        try {
            const res = await fetch(`${API_BASE}/api/search/mcp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ query: props.query, page: page, size: 10, options: props.options }),
            });
            const data = await res.json();

            // 🎯 부모의 변수들에 데이터 채워넣기
            const aiKeywords = data.intent.text_query?.keywords?.join(' ') || '';
            const aiFilters = data.intent.filters || {};
            const normalizedYear = normalizeYear(aiFilters.filing_year);

            props.setTargetKeyword(aiKeywords);
            props.setResults(data.results.data.results.hits.hits || []);
            props.setTotalHits(data.results.data.results.hits.total.value || 0);

            // AI가 찾아준 필터로 옵션 업데이트
            props.setOptions(prev => ({
                ...prev,
                filters: {
                    ...prev.filters,
                    applicant_name: aiFilters.applicant_name || prev.filters.applicant_name,
                    filing_year: normalizedYear
                },
                exact_match: {
                    application_number: data.intent.exact_match?.application_number || prev.exact_match.application_number
                }
            }));
        } catch (err) {
            console.error("AI Search Error", err);
        } finally {
            props.setIsLoading(false);
        }
    };

    // 🚀 [로직 2] AI 결과 내 재검색 (추출된 키워드 수정 시)
    const handleRefineSearch = async (page: number = 1) => {
        props.setIsLoading(true);
        props.setSearchMode("keyword")

        try {
            const res = await fetch(`${API_BASE}/api/search/standard`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ query: props.targetKeyword, page: page, size: 10, options: props.options }),
            });
            const data = await res.json();
            console.log("data:", data)
            props.setResults(data.results.data.results.hits.hits || []);
            props.setTotalHits(data.results.data.results.hits.total.value || 0);
        } finally {
            props.setIsLoading(false);
        }
    };

    console.log(`현재 모드: ${props.searchMode}, ${props.currentPage}페이지 요청`);
    useEffect(() => {
        // 검색 전이거나 로딩 중일 때는 실행하지 않음
        if (!props.hasSearched) return;

        const isBackNav = lastPageRef.current === null && props.results.length > 0;
        const isDuplicatePage = lastPageRef.current === props.currentPage;

        if (isBackNav || isDuplicatePage) {
            lastPageRef.current = props.currentPage;
            return;
        }


        if (props.searchMode === 'chat') {
            // 채팅 모드 페이징 로직 (필요시 handleAISearch 확장)
            handleAISearch(props.currentPage);
        } else {
            // 키워드 모드 페이징 로직
            handleRefineSearch(props.currentPage);
        }

        lastPageRef.current = props.currentPage;

    }, [props.currentPage]);

    return (
        <div className="w-full max-w-6xl mx-auto">
            {!props.hasSearched && (
                <AiSearchGuide onExampleClick={(ex) => props.setQuery(ex)} />
            )}

            {props.hasSearched && (
                <div className="flex flex-col gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

                        {/* 🎯 좌측: 키워드 최적화 */}
                        <div className="lg:col-span-5 bg-indigo-50/50 p-5 rounded-[2.5rem] border border-indigo-100 shadow-sm flex flex-col gap-3">
                            <div className="flex items-center gap-2 px-1">
                                <Database size={14} className="text-indigo-500" />
                                <span className="text-[11px] font-black text-indigo-600 uppercase tracking-wider">키워드 최적화</span>
                            </div>
                            <div className="flex gap-2 h-full">
                                <textarea
                                    value={props.targetKeyword}
                                    onChange={(e) => props.setTargetKeyword(e.target.value)}
                                    className="flex-1 bg-white border border-indigo-100 rounded-2xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none min-h-[80px]"
                                />
                                <button onClick={() => handleRefineSearch()} className="px-4 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all active:scale-95 flex flex-col items-center justify-center gap-1">
                                    <Search size={16} />
                                    <span>재검색</span>
                                </button>
                            </div>
                        </div>

                        {/* 🎯 우측: 상세 필터 (에디터블 인풋) */}
                        <div className="lg:col-span-7 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center gap-4">
                            <div className="flex items-center gap-2 px-1">
                                <Filter size={14} className="text-slate-400" />
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">지능형 상세 필터</span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                {/* 출원 연도 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원 연도</label>
                                    <div className="flex items-center gap-1.5 w-full">
                                        <input
                                            type="number" placeholder="From" className={inputClassName}
                                            value={props.options.filters.filing_year?.gte ?? ""}
                                            onChange={(e) => props.setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, gte: e.target.value ? Number(e.target.value) : undefined } } }))}
                                        />
                                        <span className="text-slate-300 text-xs">~</span>
                                        <input
                                            type="number" placeholder="To" className={inputClassName}
                                            value={props.options.filters.filing_year?.lte ?? ""}
                                            onChange={(e) => props.setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, lte: e.target.value ? Number(e.target.value) : undefined } } }))}
                                        />
                                    </div>
                                </div>

                                {/* 출원번호 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원번호</label>
                                    <input
                                        type="text" placeholder="번호 입력" className={inputClassName}
                                        value={props.options.exact_match?.application_number ?? ""}
                                        onChange={(e) => props.setOptions(prev => ({ ...prev, exact_match: { ...prev.exact_match, application_number: e.target.value } }))}
                                    />
                                </div>

                                {/* 출원인 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원인</label>
                                    <input
                                        type="text" placeholder="Applicant Name" className={inputClassName}
                                        value={props.options.filters.applicant_name ?? ""}
                                        onChange={(e) => props.setOptions(prev => ({ ...prev, filters: { ...prev.filters, applicant_name: e.target.value } }))}
                                    />
                                </div>

                                {/* 발명인 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">발명인</label>
                                    <input
                                        type="text" placeholder="Inventor Name" className={inputClassName}
                                        value={props.options.filters.inventor_name ?? ""}
                                        onChange={(e) => props.setOptions(prev => ({ ...prev, filters: { ...prev.filters, inventor_name: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <FixedChatBar
                onSearch={handleAISearch}
                isLoading={props.isLoading}
            />
        </div>
    );
};