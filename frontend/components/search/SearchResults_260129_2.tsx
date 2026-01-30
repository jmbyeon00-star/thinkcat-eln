import React, { useState } from "react";
import { PaginationSearchResp } from "@lib/types";
import { useRouter } from "next/router";
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    FileText,
    Hash,
    Search,
    Info,
    ExternalLink,
    Calendar,
    Layers
} from "lucide-react";

type Props = {
    resp: PaginationSearchResp | null;
    page: number;
    loading: boolean;
    keyword: string;
    onChangePage: (page: number) => void;
};

export function SearchResults({ resp, page, loading, keyword, onChangePage }: Props) {
    const router = useRouter();
    const [openRow, setOpenRow] = useState<string | null>(null);

    // --- [1] 로딩 및 데이터 없음 상태 디자인 ---
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Searching Patents...</p>
            </div>
        );
    }

    if (!resp || !resp.data?.length) {
        return (
            <div className="max-w-5xl mx-auto mt-10 p-16 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <Search size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-bold text-lg">검색 결과가 없습니다.</p>
                <p className="text-slate-400 text-sm mt-1">다른 키워드로 다시 검색해 보세요.</p>
            </div>
        );
    }

    const totalPages = resp.total_pages;
    const handleRowClick = (appNum: string) => {
        router.push(`/search/detail/application/${appNum}?keyword=${keyword}`);
    };

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
        <div className="max-w-5xl mx-auto mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* 🏷️ 결과 요약 헤더 */}
            <div className="flex items-center justify-between mb-6 px-6">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Layers size={16} className="text-indigo-500" /> Search Results
                </h3>
                <span className="text-xs font-bold text-slate-400">
                    Total <span className="text-indigo-600">{resp.total_hits.toLocaleString()}</span> Hits
                </span>
            </div>

            {/* 📊 메인 테이블 컨테이너 */}
            <div className="overflow-hidden rounded-[2.5rem] border border-slate-100 shadow-sm bg-white">
                <table className="w-full border-separate border-spacing-0">
                    <thead>
                        <tr className="bg-slate-900 text-white">
                            <th className="px-10 py-6 text-left text-[11px] font-black uppercase tracking-widest w-[65%]">
                                <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-indigo-400" /> 특허 명칭 (Title)
                                </div>
                            </th>
                            <th className="px-10 py-6 text-center text-[11px] font-black uppercase tracking-widest w-[35%]">
                                <div className="flex items-center justify-center gap-2">
                                    <Hash size={14} className="text-indigo-400" /> 출원 정보 (Info)
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {resp.data.map((item) => (
                            <React.Fragment key={item.application_number}>
                                {/* 메인 데이터 행 */}
                                <tr
                                    onClick={() => handleRowClick(item.application_number)}
                                    className="group cursor-pointer transition-all hover:bg-indigo-50/30"
                                >
                                    <td className="px-10 py-7">
                                        <div className="flex flex-col gap-1 text-left">
                                            <span className="text-[16px] font-black text-slate-800 group-hover:text-indigo-600 transition-colors leading-snug break-keep">
                                                {item.title}
                                            </span>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded">
                                                    {item.applicant_name || "Applicant N/A"}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-7 text-center">
                                        <div className="flex flex-col items-center gap-1.5">
                                            <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full group-hover:bg-indigo-100 group-hover:text-indigo-700 transition-colors">
                                                {item.application_number}
                                            </span>
                                            {item.filing_date && (
                                                <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                    <Calendar size={12} /> {item.filing_date}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 🔢 페이지네이션 섹션 */}
            <div className="mt-12 flex flex-col items-center gap-6">
                <div className="flex items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl">
                    <NavButton
                        onClick={() => onChangePage(1)}
                        disabled={!resp.has_prev}
                        icon={<ChevronsLeft size={16} />}
                    />
                    <NavButton
                        onClick={() => onChangePage(page - 1)}
                        disabled={!resp.has_prev}
                        icon={<ChevronLeft size={16} />}
                    />

                    <div className="flex items-center gap-1 px-2">
                        {pages.map((num) => (
                            <button
                                key={num}
                                onClick={() => onChangePage(num)}
                                className={`
                                    w-10 h-10 rounded-xl text-xs font-black transition-all
                                    ${num === page
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110"
                                        : "text-slate-400 hover:text-slate-900 hover:bg-white"
                                    }
                                `}
                            >
                                {num}
                            </button>
                        ))}
                    </div>

                    <NavButton
                        onClick={() => onChangePage(page + 1)}
                        disabled={!resp.has_next}
                        icon={<ChevronRight size={16} />}
                    />
                    <NavButton
                        onClick={() => onChangePage(totalPages)}
                        disabled={!resp.has_next}
                        icon={<ChevronsRight size={16} />}
                    />
                </div>

                {/* 페이지 정보 정보 */}
                <div className="px-6 py-2 bg-slate-50 rounded-full border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Page <span className="text-indigo-600">{page}</span> of <span className="text-slate-900">{totalPages}</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

// --- [보조 컴포넌트: 페이지네이션 버튼] ---
function NavButton({ onClick, disabled, icon }: { onClick: () => void, disabled: boolean, icon: React.ReactNode }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 disabled:opacity-20 hover:bg-white hover:text-slate-900 transition-all disabled:cursor-not-allowed"
        >
            {icon}
        </button>
    );
}