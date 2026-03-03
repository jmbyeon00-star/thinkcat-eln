'use client';

import { useState } from "react";
import { useRouter } from "@/routing";
import { SearchBar } from "@/components/search/SearchBar";
import { Search, Hash, FileCheck, MousePointer2 } from "lucide-react";

export default function SearchIndexPage() {
    const router = useRouter();
    const [searchType, setSearchType] = useState<"keyword" | "application" | "registration">("keyword");

    const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
        if (!keyword.trim()) return;

        if (searchType === "keyword") {
            router.push(`/search/keyword/${encodeURIComponent(keyword)}?category=${category}`);
        } else if (searchType === "application") {
            router.push(`/applicationNum/${encodeURIComponent(keyword)}`);
        } else {
            router.push(`/registrationNum/${encodeURIComponent(keyword)}`);
        }
    };

    const typeOptions = [
        { id: "keyword", label: "키워드 검색", icon: <Search size={14} /> },
        { id: "application", label: "출원번호", icon: <Hash size={14} /> },
        { id: "registration", label: "등록번호", icon: <FileCheck size={14} /> },
    ];

    return (
        <div className="w-full max-w-5xl mx-auto space-y-12 py-10">
            {/* 🎯 레이아웃 내에서 최적의 비율을 유지하는 검색 섹션 */}
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex bg-zinc-50 p-1.5 rounded-[1.5rem] border border-zinc-100 shadow-inner">
                    {typeOptions.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => setSearchType(opt.id as any)}
                            className={`
                                flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300
                                ${searchType === opt.id
                                    ? "bg-white text-blue-600 shadow-lg ring-1 ring-zinc-200/50 scale-105"
                                    : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/50"}
                            `}
                        >
                            {opt.icon}
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 메인 검색 카드 */}
            <div className="relative group animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 rounded-[3.5rem] opacity-0 group-focus-within:opacity-100 transition-opacity blur-2xl" />

                <div className="relative bg-white rounded-[3rem] shadow-2xl shadow-zinc-200/60 border border-zinc-100 p-4 md:p-6 transition-all duration-500 group-focus-within:border-blue-200">
                    <SearchBar
                        loading={false}
                        searchType={searchType}
                        onSearch={handleSearch}
                    />
                </div>

                {/* 검색 팁 & 단축키 안내 */}
                <div className="mt-8 flex justify-center items-center gap-6 animate-in fade-in duration-1000 delay-500">
                    <div className="flex items-center gap-2 text-zinc-300 font-bold text-[10px] uppercase tracking-[0.2em]">
                        <MousePointer2 size={12} />
                        <span>Press Enter to Search</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-zinc-200" />
                    <div className="text-zinc-300 font-bold text-[10px] uppercase tracking-[0.2em]">
                        AI-Powered Inference Enabled
                    </div>
                </div>
            </div>

            {/* 부가 정보 섹션 */}
            <div className="grid md:grid-cols-3 gap-6 pt-12 opacity-50 filter grayscale hover:grayscale-0 transition-all duration-700">
                {[
                    { t: "Deep Search", d: "특허 공보 전문 검색 지원" },
                    { t: "Semantic AI", d: "의미론적 유사도 분석 기술" },
                    { t: "Real-time", d: "최신 등록 데이터 실시간 반영" }
                ].map((item, i) => (
                    <div key={i} className="text-center space-y-2">
                        <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{item.t}</div>
                        <p className="text-xs text-zinc-500 font-medium">{item.d}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
