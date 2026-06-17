'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from '@/routing';
import { useSession } from "next-auth/react";
import { SearchOptions, SearchResultItem } from '@/types/search';
import { ArrowUp, ChevronLeft, ChevronRight, Search, Filter, Database, Sparkles, Settings } from 'lucide-react';

const inputClassName = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-700 placeholder:text-slate-300 text-sm";

export default function AdminSearchPage() {
    const router = useRouter();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { data: session } = useSession();
    const token = session?.access_token;

    const [hasSearched, setHasSearched] = useState(false);
    const [searchTab, setSearchTab] = useState<'ai' | 'standard'>('ai');
    const [isLoading, setIsLoading] = useState(false);
    const [standardLoading, setStandardLoading] = useState(false);
    const [AiLoading, setAiLoading] = useState(false);
    const [query, setQuery] = useState('');
    const [targetKeyword, setTargetKeyword] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalHits, setTotalHits] = useState(0);
    const [pageSize] = useState(10);

    const [options, setOptions] = useState<SearchOptions>({
        search_type: null,
        use_vector: true,
        filters: { filing_year: { gte: undefined, lte: undefined }, applicant_name: '', inventor_name: '' },
        exact_match: { application_number: '' },
        text_query: { fields: [], keyword: [] },
    });

    const handleAISearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setAiLoading(true);
        setHasSearched(true);
        setError(null);
        try {
            const response = await fetch(`${API_BASE}/api/search/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ query, options }),
            });
            const data = await response.json();
            const aiKeywords = data.intent.text_query?.keywords?.join(' ') || '';
            setTargetKeyword(aiKeywords);
            setResults(data.results.data.results.hits.hits || []);
        } catch (err) {
            setError('AI 검색 실패');
        } finally {
            setIsLoading(false);
            setAiLoading(false);
        }
    };

    const handleStandardSearch = useCallback(async (pageParam = 1) => {
        const currentKeyword = targetKeyword.trim() || query.trim();
        if (!currentKeyword) { setError('검색어를 입력해주세요.'); return; }
        const page = typeof pageParam === 'number' ? pageParam : 1;
        setIsLoading(true);
        setStandardLoading(true);
        setHasSearched(true);
        setError(null);
        setCurrentPage(page);
        try {
            const response = await fetch(`${API_BASE}/api/search/standard`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ query: currentKeyword, page, size: pageSize, options }),
            });
            const data = await response.json();
            const hitsData = data.results.data.results.hits;
            setResults(hitsData.hits || []);
            setTotalHits(hitsData.total.value || 0);
            setTargetKeyword(currentKeyword);
        } catch (err) {
            setError('검색 실패');
        } finally {
            setIsLoading(false);
            setStandardLoading(false);
        }
    }, [query, targetKeyword, options, API_BASE, token, pageSize]);

    const handleRowClick = (appNum: string) => {
        if (!appNum) return;
        router.push(`/applicationNum/${appNum}`);
    };

    return (
        <div className="min-h-screen bg-zinc-950 font-sans pb-32">
            <div className="max-w-5xl mx-auto pt-8 px-4">
                <h1 className="text-2xl font-black text-white mb-6 tracking-tight">
                    AI 특허 검색 <span className="text-indigo-400 text-sm font-bold ml-2">Admin Only</span>
                </h1>

                <div className="flex bg-zinc-800 p-1.5 rounded-2xl mb-6 w-fit">
                    <button onClick={() => setSearchTab('ai')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${searchTab === 'ai' ? 'bg-indigo-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>
                        <Sparkles size={14} /> AI 검색
                    </button>
                    <button onClick={() => setSearchTab('standard')} className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-black transition-all ${searchTab === 'standard' ? 'bg-zinc-700 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}>
                        <Settings size={14} /> 일반 검색
                    </button>
                </div>

                {(searchTab === 'standard' || hasSearched) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
                        <div className="lg:col-span-7 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4">
                            <h3 className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest">
                                <Filter size={12} /> 상세 필터
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase">출원 연도</label>
                                    <div className="flex gap-2">
                                        <input type="number" placeholder="From" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 text-sm outline-none focus:border-indigo-500" value={options.filters.filing_year?.gte ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, gte: e.target.value ? Number(e.target.value) : undefined } } }))} />
                                        <input type="number" placeholder="To" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 text-sm outline-none focus:border-indigo-500" value={options.filters.filing_year?.lte ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, lte: e.target.value ? Number(e.target.value) : undefined } } }))} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase">출원번호</label>
                                    <input type="text" placeholder="번호 입력" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 text-sm outline-none focus:border-indigo-500" value={options.exact_match?.application_number ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, exact_match: { ...prev.exact_match, application_number: e.target.value } }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase">출원인</label>
                                    <input type="text" placeholder="Applicant" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 text-sm outline-none focus:border-indigo-500" value={options.filters.applicant_name ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, applicant_name: e.target.value } }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-zinc-500 uppercase">발명인</label>
                                    <input type="text" placeholder="Inventor" className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 text-sm outline-none focus:border-indigo-500" value={options.filters.inventor_name ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, inventor_name: e.target.value } }))} />
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-5 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col">
                            <h3 className="flex items-center gap-2 text-[11px] font-black text-zinc-400 uppercase tracking-widest mb-3">
                                <Database size={12} /> 키워드 최적화
                            </h3>
                            <textarea value={targetKeyword} onChange={(e) => setTargetKeyword(e.target.value)} className="flex-1 w-full bg-zinc-800 border border-zinc-700 rounded-xl p-3 text-sm font-medium text-zinc-200 outline-none focus:border-indigo-500 resize-none min-h-[100px]" placeholder="키워드 수정..." />
                            <button onClick={() => handleStandardSearch(currentPage)} className="mt-3 w-full bg-zinc-700 hover:bg-zinc-600 text-white py-3 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all">
                                {standardLoading ? <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" /> : <><Search size={12} /> 검색</>}
                            </button>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

                {hasSearched && (
                    <div className="space-y-3">
                        <p className="text-zinc-400 text-sm font-bold">결과 {totalHits.toLocaleString()}건</p>
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="w-8 h-8 border-2 border-zinc-700 border-t-indigo-500 rounded-full animate-spin" />
                            </div>
                        ) : (
                            results.map((item: any, idx) => {
                                const appNum = item._source.application_number ?? item._source.address;
                                return (
                                    <div key={idx} onClick={() => handleRowClick(appNum)} className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-indigo-500/50 hover:bg-zinc-800 cursor-pointer transition-all">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${item._source.end_status === '등록' ? 'bg-green-900/50 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}>{item._source.end_status || '-'}</span>
                                            <span className="text-xs text-zinc-500">#{appNum}</span>
                                        </div>
                                        <h3 className="text-sm font-bold text-zinc-100 line-clamp-1">{item._source.title}</h3>
                                        <p className="text-xs text-zinc-500 mt-1">{item._source.applicant_name} · {item._source.filing_date}</p>
                                    </div>
                                );
                            })
                        )}
                        {totalHits > pageSize && (
                            <div className="flex items-center justify-center gap-2 mt-6">
                                <button disabled={currentPage === 1} onClick={() => handleStandardSearch(currentPage - 1)} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 transition-all"><ChevronLeft size={16} /></button>
                                <span className="text-xs text-zinc-400 font-bold px-4">Page {currentPage} / {Math.ceil(Math.min(totalHits, 1000) / pageSize)}</span>
                                <button disabled={currentPage >= Math.ceil(Math.min(totalHits, 1000) / pageSize)} onClick={() => handleStandardSearch(currentPage + 1)} className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 text-zinc-300 transition-all"><ChevronRight size={16} /></button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50">
                <div className="bg-zinc-800 rounded-2xl p-3 shadow-2xl flex items-end gap-2 border border-zinc-700 focus-within:border-indigo-500/50 transition-all">
                    <textarea
                        rows={2}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAISearch(); } }}
                        placeholder={searchTab === 'ai' ? "AI 특허 검색 의도 입력..." : "검색어 입력..."}
                        className="bg-transparent border-none outline-none text-zinc-100 text-sm font-medium placeholder:text-zinc-500 w-full resize-none py-1 px-2"
                    />
                    <button onClick={handleAISearch} disabled={isLoading || !query.trim()} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all flex-shrink-0 ${query.trim() && !isLoading ? 'bg-indigo-600 text-white' : 'bg-zinc-700 text-zinc-500'}`}>
                        {AiLoading ? <div className="w-4 h-4 border-2 border-zinc-500 border-t-white rounded-full animate-spin" /> : <ArrowUp size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
}
