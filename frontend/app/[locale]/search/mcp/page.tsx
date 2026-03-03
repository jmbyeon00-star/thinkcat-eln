'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from '@/routing';
import { useParams } from 'next/navigation';
import { useSession } from "next-auth/react";
import { SearchOptions, SearchResultItem } from '@/types/search';
import { ArrowUp, ChevronLeft, ChevronRight, Search, Filter, Database, Sparkles, Settings, Hash } from 'lucide-react';

const inputClassName = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-semibold text-slate-700 placeholder:text-slate-300 text-sm";

export default function SearchPage() {
    const router = useRouter();
    const params = useParams();
    const project_id = params?.project_id;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { data: session } = useSession();
    const token = session?.access_token;

    // --- [상태 관리] ---
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
    const [pageSize, setPageSize] = useState(10);

    const [options, setOptions] = useState<SearchOptions>({
        search_type: null,
        use_vector: true,
        filters: { filing_year: { gte: undefined, lte: undefined }, applicant_name: '', inventor_name: '' },
        exact_match: { application_number: '' },
        text_query: { fields: [], keyword: [] },
    });

    // --- [검색 핸들러] ---
    const handleAISearch = async () => {
        if (!query.trim()) return;
        setIsLoading(true);
        setAiLoading(true);
        setHasSearched(true);
        try {
            const response = await fetch(`${API_BASE}/api/search/mcp`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ query, options }),
            });

            const data = await response.json();
            const aiKeywords = data.intent.text_query?.keywords?.join(' ') || data.intent.text_query?.text_query || '';
            setTargetKeyword(aiKeywords);
            setResults(data.results.data.results.hits.hits || []);
            setOptions(prev => ({
                ...prev,
                filters: {
                    applicant_name: prev.filters.applicant_name || data.intent.filters?.applicant_name || '',
                    inventor_name: prev.filters.inventor_name || data.intent.filters?.inventor_name || '',
                    filing_year: {
                        gte: prev.filters.filing_year?.gte || data.intent.filters?.filing_year?.gte,
                        lte: prev.filters.filing_year?.lte || data.intent.filters?.filing_year?.lte,
                    }
                },
                exact_match: { application_number: prev.exact_match?.application_number || data.intent.exact_match?.application_number || '' }
            }));
        } catch (err) {
            setError('AI 검색 실패');
        } finally {
            setIsLoading(false);
            setAiLoading(false);
        }
    };

    const handleStandardSearch = useCallback(async (pageParam = 1) => {
        const currentKeyword = targetKeyword.trim() || query.trim();

        if (!currentKeyword) {
            setError('검색어를 입력해주세요.');
            return;
        }

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
                body: JSON.stringify({ query: currentKeyword, page: page, size: pageSize, options: options }),
            });
            const data = await response.json();

            const hitsData = data.results.data.results.hits;
            setResults(hitsData.hits || []);
            setTotalHits(hitsData.total.value || 0);
            setTargetKeyword(currentKeyword);
            setHasSearched(true);

            window.scrollTo({ top: 0, behavior: 'smooth' });

        } catch (err) {
            setError('검색 실패');
        } finally {
            setIsLoading(false);
            setStandardLoading(false);
        }
    }, [query, targetKeyword, options, API_BASE, token, pageSize]);

    const handleRowClick = (appNum: string) => {
        if (!appNum) return;
        const targetPath = project_id
            ? `/project/${project_id}/collection/${appNum}`
            : `/search/detail/application/${appNum}`;
        router.push(targetPath);
    };

    return (
        <div className="min-h-screen bg-white font-sans">
            <main className={`flex flex-col items-center w-full transition-all duration-700 ${!hasSearched ? 'justify-center min-h-[90vh]' : 'pt-20 pb-40'}`}>

                {!hasSearched && searchTab === 'ai' && (
                    <div className="text-center mb-10 animate-in fade-in zoom-in duration-1000">
                        <h1 className="text-5xl font-black text-slate-900 tracking-tighter mb-4">어떤 특허를 찾으시나요?</h1>
                        <p className="text-slate-500 text-lg font-medium">인공지능이 당신의 검색 의도를 완벽하게 이해합니다.</p>
                    </div>
                )}

                <div className={`flex bg-slate-100 p-1.5 rounded-2xl mb-10 z-10 transition-all ${!hasSearched ? 'scale-110' : 'scale-100'}`}>
                    <button onClick={() => setSearchTab('ai')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all ${searchTab === 'ai' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Sparkles size={16} /> AI 검색
                    </button>
                    <button onClick={() => setSearchTab('standard')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all ${searchTab === 'standard' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Settings size={16} /> 일반 검색
                    </button>
                </div>

                {(searchTab === 'standard' || hasSearched) && (
                    <div className="max-w-6xl w-full mx-auto px-6 mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                            <div className="lg:col-span-7 bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                                <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-widest px-2">
                                    <Filter size={14} /> 상세 필터 설정
                                </h3>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-left">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">출원 연도(Filing Year)</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" placeholder="From" className={inputClassName} value={options.filters.filing_year?.gte ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, gte: e.target.value ? Number(e.target.value) : undefined } } }))} />
                                            <input type="number" placeholder="To" className={inputClassName} value={options.filters.filing_year?.lte ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, filing_year: { ...prev.filters.filing_year, lte: e.target.value ? Number(e.target.value) : undefined } } }))} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">출원번호(Application No.)</label>
                                        <input type="text" placeholder="번호 입력" className={inputClassName} value={options.exact_match?.application_number ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, exact_match: { ...prev.exact_match, application_number: e.target.value } }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">출원인(Applicant)</label>
                                        <input type="text" placeholder="Applicant Name" className={inputClassName} value={options.filters.applicant_name ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, applicant_name: e.target.value } }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">발명인(Inventor)</label>
                                        <input type="text" placeholder="Inventor Name" className={inputClassName} value={options.filters.inventor_name ?? ""} onChange={(e) => setOptions(prev => ({ ...prev, filters: { ...prev.filters, inventor_name: e.target.value } }))} />
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-5">
                                <section className="bg-zinc-50/50 p-8 rounded-[2.5rem] border border-zinc-100 shadow-sm flex flex-col h-full text-left">
                                    <h3 className="flex items-center gap-2 text-[11px] font-black text-zinc-600 uppercase tracking-widest mb-4">
                                        <Database size={14} /> 키워드 최적화
                                    </h3>
                                    <textarea
                                        value={targetKeyword}
                                        onChange={(e) => setTargetKeyword(e.target.value)}
                                        className="flex-1 w-full bg-white border border-zinc-100 rounded-2xl p-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-zinc-200/50 transition-all resize-none min-h-[150px]"
                                        placeholder="키워드를 직접 입력하거나 수정하세요..."
                                    />
                                    <button onClick={() => handleStandardSearch(currentPage)} className="mt-4 w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] shadow-xl shadow-slate-200">
                                        {standardLoading ? <div className="w-4 h-4 border-2 border-slate-300 border-t-white rounded-full animate-spin" /> : <><Search size={14} /> 키워드 검색</>}
                                    </button>
                                </section>
                            </div>
                        </div>
                    </div>
                )}

                {hasSearched && (
                    <div className="max-w-6xl w-full mx-auto px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="flex items-center justify-between px-2 pt-10 border-t border-slate-100 text-left">
                            <h2 className="text-2xl font-black text-slate-900">검색 결과 <span className="text-indigo-600">{isLoading ? 0 : totalHits}</span></h2>
                        </div>
                        {isLoading ?
                            <div className="flex flex-col items-center justify-center gap-4">
                                <div className="relative w-12 h-12">
                                    <div className="absolute inset-0 rounded-full border-4 border-slate-100/50"></div>
                                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin shadow-lg"></div>
                                </div>
                                <p className="text-sm font-bold text-slate-400 animate-pulse">특허 데이터를 불러오는 중...</p>
                            </div>
                            :
                            <div className="space-y-4">
                                {results.map((item: any, idx: number) => {
                                    const appNum = item._source.application_number ?? item._source.address;
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => handleRowClick(appNum)}
                                            className="group p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                                                <ChevronRight size={24} />
                                            </div>

                                            <div className="flex flex-col gap-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${item._source.end_status === '등록' ? 'bg-green-100 text-green-700' :
                                                        item._source.end_status === '거절' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                                        }`}>
                                                        {item._source.end_status || '상태미상'}
                                                    </span>
                                                    <span className="text-xs font-bold text-slate-400">#{appNum}</span>
                                                </div>

                                                <h3 className="text-lg font-bold text-slate-900 leading-snug group-hover:text-indigo-700 transition-colors line-clamp-2 pr-8">
                                                    {item._source.title}
                                                </h3>

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2 pt-4 border-t border-slate-50 text-sm">
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wider">출원인</p>
                                                        <p className="font-semibold text-slate-700 truncate">{item._source.applicant_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wider">발명인</p>
                                                        <p className="font-semibold text-slate-700 truncate">{item._source.inventor_name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wider">출원일</p>
                                                        <p className="font-semibold text-slate-700">{item._source.filing_date}</p>
                                                    </div>

                                                    <div className="hidden md:block">
                                                        <p className="text-slate-400 font-bold mb-1 text-xs uppercase tracking-wider">요약</p>
                                                        <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed italic">"{item._source.abstract?.substring(0, 50)}..."</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {hasSearched && totalHits > 0 && (
                                    <div className="flex flex-col items-center gap-4 mt-12 mb-20">
                                        <div className="flex items-center gap-2">
                                            <button
                                                disabled={currentPage === 1 || isLoading}
                                                onClick={() => handleStandardSearch(currentPage - 1)}
                                                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-20 transition-all text-slate-600"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>

                                            {Array.from({ length: Math.min(10, Math.ceil(Math.min(totalHits, 1000) / pageSize)) }).map((_, i) => {
                                                const pageNum = i + 1;
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => handleStandardSearch(pageNum)}
                                                        className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${currentPage === pageNum
                                                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                                            : 'text-slate-400 hover:bg-slate-50'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}

                                            <button
                                                disabled={currentPage >= Math.ceil(Math.min(totalHits, 1000) / pageSize) || isLoading}
                                                onClick={() => handleStandardSearch(currentPage + 1)}
                                                className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-20 transition-all text-slate-600"
                                            >
                                                <ChevronRight size={20} />
                                            </button>
                                        </div>

                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Total {totalHits.toLocaleString()} Results • Page {currentPage}
                                        </p>
                                    </div>
                                )}
                            </div>
                        }
                    </div>
                )}
            </main>

            <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-50">
                <div className="bg-[#f0f4f9] rounded-[32px] p-4 shadow-2xl flex items-end gap-2 focus-within:bg-white transition-all border border-transparent focus-within:border-slate-200">
                    <textarea
                        rows={3}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchTab === 'ai' ? "특허 의도를 입력하세요 (예: 2020년 이후 삼성전자의 자율주행 특허)" : "일반 검색어를 입력하세요"}
                        className="bg-transparent border-none outline-none text-slate-800 text-[17px] font-medium placeholder:text-slate-400 w-full resize-none py-2 px-2"
                    />
                    <button onClick={handleAISearch} disabled={isLoading || !query.trim()} className={`w-14 h-12 flex items-center justify-center rounded-full transition-all ${query.trim() && !isLoading ? (searchTab === 'ai' ? 'bg-indigo-600' : 'bg-slate-800') + ' text-white shadow-lg' : 'text-slate-300 bg-transparent'}`}>
                        {AiLoading ? <span className="animate-spin text-lg">✦</span> : <ArrowUp size={24} strokeWidth={2.5} />}
                    </button>
                </div>
                {query && !results.length && (
                    <div className="absolute -top-12 left-10 bg-indigo-600 text-white text-[10px] font-black px-4 py-2 rounded-full shadow-xl animate-bounce">
                        질문을 입력하셨나요? 검색을 눌러보세요!
                    </div>
                )}
            </div>
        </div>
    );
}
