'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from "next-auth/react";
import { Database, FileText, Filter, Search, History, ShoppingCart, X, Trash2, Plus } from 'lucide-react';
import { AiSearchGuide } from "./AiSearchGuide";
import { FixedChatBar } from "./FixedChatBar";
import { SearchOptions, SearchResultItem } from '@/types/search';
import { useSearchContext } from '@/contexts/SearchContext';
import { PatentBasket } from './PatentBasket';
import { TrashBin } from './TrashBin';
import { saveSearchQuery } from '@/lib/searchHistoryApi';
import { apiFetch } from '@/lib/apiFetch';
import { SearchHistoryList } from './SearchHistoryList';

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

    const { selectedPatents, togglePatentSelection, submittedQuery, setSubmittedQuery, hiddenPatents, clearSelectedPatents } = useSearchContext();

    const flatSelectedPatents = Object.entries(selectedPatents).flatMap(([query, patents]) =>
        patents.map(patent => ({ query, ...patent }))
    );

    const [isBasketOpen, setIsBasketOpen] = useState(false);
    const [isTrashOpen, setIsTrashOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [searchMethod, setSearchMethod] = useState<'centroid' | 'weighted' | 'script_score'>('centroid');
    const totalSelectedCount = (Object.values(selectedPatents) as any[][]).reduce((sum: number, arr: any[]) => sum + arr.length, 0);

    // 헬퍼: 연도 데이터 정규화
    const normalizeYear = (yearData: any) => {
        if (!yearData) return { gte: undefined, lte: undefined };
        if (typeof yearData === 'number') return { gte: yearData, lte: yearData };
        return {
            gte: yearData.gte ?? yearData.from ?? undefined,
            lte: yearData.lte ?? yearData.to ?? undefined,
        };
    };

    const INITIAL_OPTIONS: SearchOptions = {
        search_type: null,           // 제공해주신 데이터 기준 null
        use_vector: true,            // 제공해주신 데이터 기준 true
        text_query: {
            fields: [],
            keyword: []              // 'keywords'가 아닌 'keyword'임에 주의!
        },
        filters: {
            applicant_name: '',      // undefined 대신 빈 문자열
            inventor_name: '',       // undefined 대신 빈 문자열
            filing_year: {
                gte: undefined,
                lte: undefined
            }
        },
        exact_match: {
            application_number: ''   // undefined 대신 빈 문자열
        }
    };

    const handleNewSearch = () => {
        props.setQuery('');
        setSubmittedQuery('');
        props.setResults([]);
        props.setTotalHits(0);
        props.setHasSearched(false);
        props.setOptions(INITIAL_OPTIONS);
        props.setTargetKeyword('');
        clearSelectedPatents();
        lastPageRef.current = null;
    };
    // 🚀 [로직 1] 최초 AI 의도 검색 (MCP API)
    const handleAISearch = async (page: number = 1) => {
        const allSelectedPatents = Object.values(selectedPatents).flat();

        // 새로운 검색인지 확인 (검색창에 텍스트가 있는 경우)
        const isNewSearch = props.query.trim() !== "";
        // 현재 입력창의 쿼리 (없으면 이전 제출된 쿼리 사용 - 페이징/이동 대응)
        const currentQuery = isNewSearch ? props.query.trim() : submittedQuery;

        // 쿼리도 없고 선택된 특허도 없으면 리턴
        if (!currentQuery && allSelectedPatents.length === 0) return;

        // 선택된 특허만 있고 이전에 제출된 쿼리도 없으면 유사 검색으로 전환 (완전 최초 검색인 경우만)
        if (!currentQuery && allSelectedPatents.length > 0 && !submittedQuery) {
            handleSimilarSearch('centroid', allSelectedPatents);
            return;
        }

        // 검색 실행 시 submittedQuery 업데이트 (새 검색일 때만)
        if (isNewSearch) {
            setSubmittedQuery(props.query);
        }

        props.setIsLoading(true);
        props.setHasSearched(true);
        props.setSearchMode("chat")

        try {
            // 선택된 특허가 있으면 reference_patents로 함께 전송
            const requestBody: any = {
                query: currentQuery,
                page: page,
                size: 10,
                options: isNewSearch ? INITIAL_OPTIONS : props.options
            };

            if (allSelectedPatents.length > 0) {
                requestBody.reference_patents = allSelectedPatents.map((p: any) => ({
                    title: p._source?.title || p.title,
                    abstract: p._source?.abstract || p.abstract,
                    application_number: p._source?.application_number || p.application_number
                }));
                requestBody.search_method = searchMethod;
            }

            const res = await apiFetch(`${API_BASE}/api/search/mcp`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
            });
            const data = await res.json();

            // 🎯 부모의 변수들에 데이터 채워넣기
            const aiKeywords = data.intent.text_query?.keywords?.join(' ') || '';
            const aiFilters = data.intent.filters || {};
            const aiExact = data.intent.exact_match || {};
            const normalizedYear = normalizeYear(aiFilters.filing_year);

            props.setTargetKeyword(aiKeywords);
            props.setResults(data.results.data.results.hits.hits || []);
            props.setTotalHits(data.results.data.results.hits.total.value || 0);
            lastPageRef.current = page;

            // AI가 찾아준 필터로 옵션 업데이트 (새로운 검색일 때만 AI 의도 반영)
            if (isNewSearch) {
                props.setOptions((prev: SearchOptions) => ({
                    ...INITIAL_OPTIONS,
                    filters: {
                        ...prev.filters,
                        applicant_name: aiFilters.applicant_name || '',
                        inventor_name: aiFilters.inventor_name || '',
                        filing_year: normalizedYear
                    },
                    exact_match: {
                        application_number: aiExact.application_number || ''
                    }
                }));
            }

            if (token && res.status === 200) {
                try {
                    await saveSearchQuery(isNewSearch ? props.query : currentQuery, "ai", token);
                } catch (saveError) {
                    console.error("Failed to save AI search query to history:", saveError);
                }
            }
            if (isNewSearch) props.setQuery('');
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

        // 선택된 특허 목록
        const allSelectedPatents = Object.values(selectedPatents).flat();

        try {
            const requestBody: any = {
                query: props.targetKeyword,
                page: page,
                size: 10,
                options: props.options
            };

            // 선택된 특허가 있으면 함께 전송
            if (allSelectedPatents.length > 0) {
                requestBody.reference_patents = allSelectedPatents.map((p: any) => ({
                    title: p._source?.title || p.title,
                    abstract: p._source?.abstract || p.abstract,
                    application_number: p._source?.application_number || p.application_number
                }));
                requestBody.search_method = searchMethod;
            }

            const res = await apiFetch(`${API_BASE}/api/search/standard`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify(requestBody),
            });
            const data = await res.json();
            props.setResults(data.results.data.results.hits.hits || []);
            props.setTotalHits(data.results.data.results.hits.total.value || 0);
            lastPageRef.current = page;

            if (token && props.targetKeyword) {
                try {
                    await saveSearchQuery(props.targetKeyword, "standard", token);
                } catch (saveError) {
                    console.error("Failed to save refined search query to history:", saveError);
                }
            }
        } finally {
            props.setIsLoading(false);
        }
    };

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
            // 채팅 모드 페이징 로직
            const allSelectedPatents = Object.values(selectedPatents).flat();

            // 유사 검색 상태인지 확인 ([유사검색]으로 시작하는 쿼리)
            if (submittedQuery.startsWith('[유사검색]')) {
                handleSimilarSearch('centroid', allSelectedPatents, props.currentPage);
            } else if (submittedQuery || allSelectedPatents.length > 0) {
                handleAISearch(props.currentPage);
            }
        } else {
            // 키워드 모드 페이징 로직
            handleRefineSearch(props.currentPage);
        }

        lastPageRef.current = props.currentPage;
    }, [props.currentPage]);

    // 유사 특허 검색 핸들러
    type SimilarSearchMethod = 'centroid' | 'script_score' | 'weighted';

    const handleSimilarSearch = async (method: SimilarSearchMethod, patents: any[], page: number = 1) => {
        if (patents.length === 0) return;

        props.setIsLoading(true);
        props.setHasSearched(true);
        setSubmittedQuery(`[유사검색] ${patents.length}건의 특허 기반`);

        try {
            const res = await apiFetch(`${API_BASE}/api/search/similar`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    method,
                    patents: patents.map(p => ({
                        title: p._source?.title || p.title,
                        abstract: p._source?.abstract || p.abstract,
                        application_number: p._source?.application_number || p.application_number
                    })),
                    exclude_app_numbers: patents.map(p => p._source?.application_number || p.application_number),
                    size: 10,
                    page: page
                }),
            });
            const data = await res.json();

            // MCP 응답 구조: data.results.data.results.hits.hits
            props.setResults(data.results?.data?.results?.hits?.hits || []);
            props.setTotalHits(data.results?.data?.results?.hits?.total?.value || 0);
            lastPageRef.current = page;
            props.setTargetKeyword(`유사 특허 검색 (${method})`);

            if (token && res.status === 200) {
                try {
                    await saveSearchQuery(submittedQuery || `[유사검색] ${patents.length}건`, "similar", token);
                } catch (saveError) {
                    console.error("Failed to save similar search query to history:", saveError);
                }
            }
        } catch (err) {
            console.error("Similar Search Error", err);
        } finally {
            props.setIsLoading(false);
            setIsBasketOpen(false);
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto">
            <PatentBasket
                isOpen={isBasketOpen}
                onClose={() => setIsBasketOpen(false)}
                onSimilarSearch={handleSimilarSearch}
            />
            <TrashBin isOpen={isTrashOpen} onClose={() => setIsTrashOpen(false)} />

            {!props.hasSearched && (
                <AiSearchGuide onExampleClick={(ex) => props.setQuery(ex)} />
            )}

            {props.hasSearched && (
                <div className="flex flex-col gap-4 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">

                        <div className="lg:col-span-7 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col justify-center gap-4">
                            <div className="flex items-center gap-2 px-1">
                                <Filter size={14} className="text-slate-400" />
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">상세 필터</span>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                {/* 출원 연도 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원 연도</label>
                                    <div className="flex items-center gap-1.5 w-full">
                                        <input
                                            type="number" placeholder="From" className={inputClassName}
                                            value={props.options.filters.filing_year?.gte ?? ""}
                                            onChange={(e) => props.setOptions((prev: SearchOptions) => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, gte: e.target.value ? Number(e.target.value) : undefined } } }))}
                                        />
                                        <span className="text-slate-300 text-xs">~</span>
                                        <input
                                            type="number" placeholder="To" className={inputClassName}
                                            value={props.options.filters.filing_year?.lte ?? ""}
                                            onChange={(e) => props.setOptions((prev: SearchOptions) => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, lte: e.target.value ? Number(e.target.value) : undefined } } }))}
                                        />
                                    </div>
                                </div>

                                {/* 출원번호 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원번호</label>
                                    <input
                                        type="text" placeholder="번호 입력" className={inputClassName}
                                        value={props.options.exact_match?.application_number ?? ""}
                                        onChange={(e) => props.setOptions((prev: SearchOptions) => ({ ...prev, exact_match: { ...prev.exact_match, application_number: e.target.value } }))}
                                    />
                                </div>

                                {/* 출원인 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">출원인</label>
                                    <input
                                        type="text" placeholder="Applicant Name" className={inputClassName}
                                        value={props.options.filters.applicant_name ?? ""}
                                        onChange={(e) => props.setOptions((prev: SearchOptions) => ({ ...prev, filters: { ...prev.filters, applicant_name: e.target.value } }))}
                                    />
                                </div>

                                {/* 발명인 */}
                                <div className="flex items-center gap-3">
                                    <label className="shrink-0 w-16 text-[10px] font-black text-slate-400 uppercase">발명인</label>
                                    <input
                                        type="text" placeholder="Inventor Name" className={inputClassName}
                                        value={props.options.filters.inventor_name ?? ""}
                                        onChange={(e) => props.setOptions((prev: SearchOptions) => ({ ...prev, filters: { ...prev.filters, inventor_name: e.target.value } }))}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-5 bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm flex flex-col gap-4 min-h-[180px]">

                            <div className="flex items-center justify-between w-full px-1 mb-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setIsBasketOpen(true)}
                                        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-95 flex-shrink-0 group ${totalSelectedCount > 0
                                            ? 'bg-white border-indigo-200 text-indigo-600 shadow-sm hover:border-indigo-300'
                                            : 'bg-zinc-100/50 border-zinc-200 text-zinc-400'
                                            }`}
                                        title="선택된 문서 목록"
                                    >
                                        <FileText size={18} className={totalSelectedCount > 0 ? 'text-indigo-500' : 'text-zinc-400'} />

                                        {totalSelectedCount > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-sm animate-in zoom-in duration-300">
                                                {totalSelectedCount > 99 ? '99+' : totalSelectedCount}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setIsTrashOpen(true)}
                                        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-95 flex-shrink-0 ${hiddenPatents.length > 0
                                            ? 'bg-white border-slate-300 text-slate-600 shadow-sm hover:border-slate-400'
                                            : 'bg-zinc-100/50 border-zinc-200 text-zinc-400'
                                            }`}
                                        title="휴지통"
                                    >
                                        <Trash2 size={18} className={hiddenPatents.length > 0 ? 'text-slate-500' : 'text-zinc-400'} />

                                        {hiddenPatents.length > 0 && (
                                            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 bg-slate-600 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white shadow-sm animate-in zoom-in duration-300">
                                                {hiddenPatents.length > 99 ? '99+' : hiddenPatents.length}
                                            </span>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                                        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all active:scale-95 flex-shrink-0 ${isHistoryOpen
                                            ? 'bg-white border-indigo-200 text-indigo-600 shadow-sm hover:border-indigo-300'
                                            : 'bg-zinc-100/50 border-zinc-200 text-zinc-400'
                                            }`}
                                        title="검색 기록"
                                    >
                                        <History size={18} className={isHistoryOpen ? 'text-indigo-500' : 'text-zinc-400'} />
                                    </button>
                                </div>

                                <button
                                    onClick={handleNewSearch}
                                    className="flex items-center justify-center w-9 h-9 rounded-xl border border-zinc-200 bg-zinc-100/50 text-zinc-400 transition-all active:scale-95 hover:bg-white hover:border-indigo-200 hover:text-indigo-600 shadow-sm"
                                    title="새 검색 시작"
                                >
                                    <Plus size={18} />
                                </button>
                            </div>

                            {flatSelectedPatents.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto px-1">
                                    {flatSelectedPatents.map((p) => (
                                        <div
                                            key={p._source.application_number}
                                            className="flex items-center gap-1 px-2 py-1 bg-white border border-indigo-100 rounded-lg shadow-sm animate-in zoom-in duration-200"
                                        >
                                            <span className="text-[10px] font-bold text-indigo-500 font-mono">
                                                #{p._source.application_number}
                                            </span>
                                            <button
                                                onClick={() => togglePatentSelection(p.query, p)}
                                                className="p-0.5 hover:bg-rose-50 hover:text-rose-500 rounded text-slate-300 transition-colors"
                                            >
                                                <X size={10} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 2. 하단 라인: 텍스트 입력 + 재검색 버튼 (가로 배치) */}
                            <div className="flex gap-2 flex-1">
                                <textarea
                                    value={props.targetKeyword}
                                    onChange={(e) => props.setTargetKeyword(e.target.value)}
                                    className="flex-1 bg-white border border-indigo-100 rounded-2xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none shadow-inner placeholder:text-zinc-300"
                                    placeholder="최적화 키워드..."
                                />

                                <button
                                    onClick={() => handleRefineSearch()}
                                    className="px-5 bg-indigo-600 text-white rounded-2xl font-black text-xs hover:bg-indigo-700 transition-all active:scale-95 flex flex-col items-center justify-center gap-1.5 shadow-lg shadow-indigo-200 min-w-[80px]"
                                >
                                    <Search size={18} />
                                    <span className="whitespace-nowrap font-black">재검색</span>
                                </button>
                            </div>
                        </div>


                    </div>
                </div>
            )}

            <FixedChatBar
                onSearch={handleAISearch}
                isLoading={props.isLoading}
                onOpenBasket={() => setIsBasketOpen(true)}
                onOpenTrash={() => setIsTrashOpen(true)}
                onOpenHistory={() => setIsHistoryOpen(!isHistoryOpen)}
                searchMethod={searchMethod}
                onSearchMethodChange={setSearchMethod}
            />

            {isHistoryOpen && (
                <SearchHistoryList
                    onSelectHistoryItem={(query: string, searchType: string) => {
                        props.setQuery(query); // Update the main search input
                        setSubmittedQuery(query); // Also set submitted query for AI searches
                        if (searchType === "ai") {
                            handleAISearch();
                        } else if (searchType === "standard") {
                            props.setTargetKeyword(query); // For standard search, set targetKeyword
                            handleRefineSearch();
                        } else if (searchType === "similar") {
                            handleAISearch();
                        }
                    }}
                    onClose={() => setIsHistoryOpen(false)}
                />
            )}
        </div>
    );
};