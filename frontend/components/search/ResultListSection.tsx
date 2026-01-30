import React from 'react';
import { useRouter } from 'next/router';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface ResultListSectionProps {
    results: any[];
    totalHits: number;
    currentPage: number;
    isLoading: boolean;
    pageSize: number;
    onPageChange: (page: number) => void;
}

export const ResultListSection = ({
    results,
    totalHits,
    currentPage,
    isLoading,
    pageSize,
    onPageChange
}: ResultListSectionProps) => {

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

    const router = useRouter();
    // 페이지네이션 로직 (최대 10개 혹은 1000건 제한 기준)
    const totalPages = Math.ceil(Math.min(totalHits, 1000) / pageSize);
    const pageNumbers = Array.from({ length: Math.min(10, totalPages) }, (_, i) => i + 1);

    const handleRowClick = (appNum: string) => {
        if (!appNum) return;
        // 현재 스크롤 위치 저장 (뒤로 오면 복구하기 위함)
        sessionStorage.setItem('search_scroll_pos', window.scrollY.toString());

        // 상세 페이지로 이동 (프로젝트 ID가 있을 경우와 없을 경우 분기 처리 가능)
        const targetPath = `/search/detail/application/${appNum}`;
        router.push(targetPath);
    };

    return (
        <div className="max-w-6xl w-full mx-auto px-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* 결과 헤더 */}
            <div className="flex items-center justify-between px-2 pt-10 border-t border-slate-100 text-left">
                <h2 className="text-2xl font-black text-slate-900">
                    검색 결과 <span className="text-indigo-600">{totalHits.toLocaleString()}</span>
                </h2>
            </div>

            {/* 특허 리스트 */}
            <div className="space-y-4">
                {results.map((item: any, idx: number) => {
                    const appNum = item._source.application_number ?? item._source.address;
                    const status = item._source.end_status || '상태미상';

                    return (
                        <div
                            key={`${appNum}-${idx}`}
                            onClick={() => handleRowClick(appNum)}
                            className="group p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-xl hover:shadow-indigo-100/50 hover:-translate-y-1 hover:border-indigo-200 transition-all cursor-pointer relative overflow-hidden text-left"
                        >
                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                                <ChevronRight size={24} />
                            </div>

                            <div className="flex flex-col gap-3">
                                <div className="flex items-center gap-2">
                                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider 
                                        ${status === '등록' ? 'bg-green-100 text-green-700' :
                                            status === '거절' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}
                                    >
                                        {status}
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
                                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
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