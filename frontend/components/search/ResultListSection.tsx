'use client';

import React, { useState } from 'react';
import { useRouter } from '@/routing';
import { ChevronRight, ChevronLeft, ExternalLink, Check, LayoutList, LayoutGrid, Trash2 } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';

interface ResultListSectionProps {
    searchType: "keyword" | "application" | "registration";
    results: any[];
    totalHits: number;
    currentPage: number;
    isLoading: boolean;
    pageSize: number;
    onPageChange: (page: number) => void;
}

export const ResultListSection = ({
    searchType,
    results,
    totalHits,
    currentPage,
    isLoading,
    pageSize,
    onPageChange
}: ResultListSectionProps) => {

    const { searchTab, submittedQuery, togglePatentSelection, isPatentSelected, hidePatent, isPatentHidden } = useSearchContext();
    const router = useRouter();
    const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
    const totalPages = Math.ceil(Math.min(totalHits, 1000) / pageSize);
    const pageNumbers = Array.from({ length: Math.min(10, totalPages) }, (_, i) => i + 1);

    // 숨김 처리된 특허를 제외한 결과
    const visibleResults = results.filter((item: any) => {
        const appNum = item._source.application_number ?? item._source.address;
        return !isPatentHidden(appNum);
    });

    // 로딩 상태 UI
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100/50"></div>
                    <div className="absolute inset-0 rounded-full border-4 border-t-indigo-600 border-r-transparent border-b-transparent border-l-transparent animate-spin shadow-lg"></div>
                </div>
                <p className="text-sm font-bold text-slate-400 animate-pulse">특허 데이터를 불러오는 중...</p>
            </div>
        );
    }

    // 결과가 없을 때
    if (results.length === 0) {
        return (
            <div className="text-center py-20 text-slate-400 font-bold">
                검색 결과가 없습니다.
            </div>
        );
    }



    // 상세 페이지로 이동
    const goToDetail = (appNum: string) => {
        if (!appNum) return;
        sessionStorage.setItem('search_scroll_pos', window.scrollY.toString());

        let targetPath = "";
        if (searchType === "application") {
            targetPath = `/applicationNum/${appNum}`;
        } else if (searchType === "registration") {
            targetPath = `/registrationNum/${appNum}`;
        } else {
            // 키워드 검색 등에서 기본적으로 출원번호 상세로 이동
            targetPath = `/applicationNum/${appNum}`;
        }
        router.push(targetPath);
    };

    // 행 클릭 핸들러: AI 검색이면 선택 토글, 일반 검색이면 상세 페이지 이동
    const handleRowClick = (item: any) => {
        const appNum = item._source.application_number ?? item._source.address;
        if (!appNum) return;

        if (searchTab === 'ai') {
            // AI 검색: 특허 선택/해제
            togglePatentSelection(submittedQuery, {
                title: item._source.title || '',
                abstract: item._source.abstract || '',
                application_number: appNum,
            });
        } else {
            // 일반 검색: 상세 페이지로 이동
            goToDetail(appNum);
        }
    };

    return (
        <div className="max-w-6xl w-full mx-auto px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 결과 헤더 */}
            <div className="flex items-center justify-between px-2 pt-10 border-t border-slate-100 text-left">
                <h2 className="text-2xl font-black text-slate-900">
                    검색 결과 <span className={searchTab === 'ai' ? 'text-indigo-600' : 'text-blue-600'}>{totalHits.toLocaleString()}</span>
                </h2>

                {/* AI 검색일 때만 뷰 토글 표시 */}
                {searchTab === 'ai' && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="리스트 뷰"
                        >
                            <LayoutList size={18} />
                        </button>
                        <button
                            onClick={() => setViewMode('card')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'card' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                            title="카드 뷰"
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                )}
            </div>

            {/* 카드 뷰 (AI 검색 전용) - 3x3 그리드에 맞게 9개만 표시 */}
            {searchTab === 'ai' && viewMode === 'card' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleResults.slice(0, 9).map((item: any, idx: number) => {
                        const appNum = item._source.application_number ?? item._source.address;
                        const status = item._source.end_status || '상태미상';
                        const isSelected = isPatentSelected(submittedQuery, appNum);

                        return (
                            <div
                                key={`card-${appNum}-${idx}`}
                                onClick={() => handleRowClick(item)}
                                className={`group p-5 bg-white border rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden ${isSelected
                                    ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                                    : 'border-slate-100 hover:border-indigo-200'
                                    }`}
                            >
                                {/* 선택 체크박스 */}
                                <div className={`absolute top-3 left-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                    ? 'bg-indigo-600 border-indigo-600'
                                    : 'border-slate-300 group-hover:border-indigo-400'
                                    }`}>
                                    {isSelected && <Check size={12} className="text-white" />}
                                </div>

                                {/* 상세 페이지 버튼 & 삭제 버튼 */}
                                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            goToDetail(appNum);
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-indigo-600 hover:text-white text-slate-400 transition-all"
                                        title="상세 페이지로 이동"
                                    >
                                        <ExternalLink size={14} />
                                    </button>
                                    <button
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            hidePatent({
                                                application_number: appNum,
                                                title: item._source.title || '',
                                                hiddenAt: new Date()
                                            });
                                        }}
                                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-500 hover:text-white text-slate-400 transition-all"
                                        title="검색 결과에서 숨기기"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="pt-6">
                                    {/* 상태 뱃지 */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${status === '등록' ? 'bg-green-100 text-green-700' :
                                            status === '거절' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {status}
                                        </span>
                                    </div>

                                    {/* 제목 */}
                                    <h3 className={`text-sm font-bold leading-snug line-clamp-2 mb-3 min-h-[2.5rem] ${isSelected ? 'text-indigo-700' : 'text-slate-800 group-hover:text-indigo-700'
                                        }`}>
                                        {item._source.title}
                                    </h3>

                                    {/* 요약 */}
                                    <p className="text-xs text-slate-500 line-clamp-3 mb-4 min-h-[3rem] italic">
                                        {item._source.abstract?.substring(0, 100)}...
                                    </p>

                                    {/* 메타 정보 */}
                                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                                        <p className="text-[10px] text-slate-400">
                                            <span className="font-bold">출원번호:</span> {appNum}
                                        </p>
                                        <p className="text-[10px] text-slate-400 truncate">
                                            <span className="font-bold">출원인:</span> {item._source.applicant_name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            <span className="font-bold">출원일:</span> {item._source.filing_date}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* 리스트 뷰 (기본) */
                <div className="space-y-4">
                    {visibleResults.map((item: any, idx: number) => {
                        const appNum = item._source.application_number ?? item._source.address;
                        const status = item._source.end_status || '상태미상';
                        const isSelected = searchTab === 'ai' && isPatentSelected(submittedQuery, appNum);

                        return (
                            <div
                                key={`${appNum}-${idx}`}
                                onClick={() => handleRowClick(item)}
                                className={`group p-6 bg-white border rounded-[2rem] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer relative overflow-hidden text-left ${isSelected
                                    ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20 hover:shadow-indigo-100/50'
                                    : searchTab === 'ai'
                                        ? 'border-slate-100 hover:border-indigo-200 hover:shadow-indigo-100/50'
                                        : 'border-slate-100 hover:border-blue-200 hover:shadow-blue-100/50'
                                    }`}
                            >
                                {/* AI 검색 시 선택 표시 */}
                                {searchTab === 'ai' && (
                                    <div className={`absolute top-4 left-4 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                        ? 'bg-indigo-600 border-indigo-600'
                                        : 'border-slate-300 group-hover:border-indigo-400'
                                        }`}>
                                        {isSelected && <Check size={14} className="text-white" />}
                                    </div>
                                )}

                                {/* 상세 페이지 이동 버튼 & 삭제 버튼 */}
                                <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                    <button
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            goToDetail(appNum);
                                        }}
                                        className={`p-2 rounded-xl bg-slate-100 text-slate-500 transition-all ${searchTab === 'ai' ? 'hover:bg-indigo-600 hover:text-white' : 'hover:bg-blue-600 hover:text-white'
                                            }`}
                                        title="상세 페이지로 이동"
                                    >
                                        <ExternalLink size={18} />
                                    </button>
                                    <button
                                        onClick={(e: React.MouseEvent) => {
                                            e.stopPropagation();
                                            hidePatent({
                                                application_number: appNum,
                                                title: item._source.title || '',
                                                hiddenAt: new Date()
                                            });
                                        }}
                                        className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-rose-500 hover:text-white transition-all"
                                        title="검색 결과에서 숨기기"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>

                                <div className={`flex flex-col gap-3 ${searchTab === 'ai' ? 'pl-8' : ''}`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider
                                            ${status === '등록' ? 'bg-green-100 text-green-700' :
                                                status === '거절' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
                                        >
                                            {status}
                                        </span>
                                        <span className="text-xs font-bold text-slate-400">#{appNum}</span>
                                    </div>

                                    <h3 className={`text-lg font-bold leading-snug transition-colors line-clamp-2 pr-12 ${isSelected
                                        ? 'text-indigo-700'
                                        : searchTab === 'ai'
                                            ? 'text-slate-900 group-hover:text-indigo-700'
                                            : 'text-slate-900 group-hover:text-blue-700'
                                        }`}>
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
                                            <p className="text-slate-500 text-xs line-clamp-2 leading-relaxed italic">
                                                "{item._source.abstract?.substring(0, 50)}..."
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 하단 페이지네이션 */}
            <div className="flex flex-col items-center gap-4 mt-12 mb-20">
                <div className="flex items-center gap-2">
                    <button
                        disabled={currentPage === 1 || isLoading}
                        onClick={() => onPageChange(currentPage - 1)}
                        className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-20 transition-all text-slate-600"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {pageNumbers.map((pageNum) => (
                        <button
                            key={pageNum}
                            onClick={() => onPageChange(pageNum)}
                            className={`w-10 h-10 rounded-xl font-black text-xs transition-all
                                ${currentPage === pageNum
                                    ? searchTab === 'ai'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
                                        : 'bg-blue-600 text-white shadow-lg shadow-blue-100'
                                    : 'text-slate-400 hover:bg-slate-50'}`}
                        >
                            {pageNum}
                        </button>
                    ))}

                    <button
                        disabled={currentPage >= totalPages || isLoading}
                        onClick={() => onPageChange(currentPage + 1)}
                        className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-20 transition-all text-slate-600"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>

                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Total {totalHits.toLocaleString()} Results • Page {currentPage}
                </p>
            </div>
        </div>
    );
};