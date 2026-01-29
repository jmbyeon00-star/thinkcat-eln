import React, { useState } from 'react';
import { ArrowLeft, Hash, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
    collectionName: string;
    items: any[];
    onBack: () => void;
}

export default function CollectionDataView({ collectionName, items, onBack }: Props) {
    const [activeTab, setActiveTab] = useState<"correct" | "counter">("correct");
    const [page, setPage] = useState(1);
    const perPage = 10;

    // 데이터 필터링
    const correctItems = items.filter(i => i.used !== 0);
    const counterItems = items.filter(i => i.used === 0);
    const displayItems = activeTab === "correct" ? correctItems : counterItems;

    const totalPages = Math.ceil(displayItems.length / perPage) || 1;
    const pagedItems = displayItems.slice((page - 1) * perPage, page * perPage);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* 상단 헤더 */}
            <div className="flex justify-between items-center bg-white p-6 rounded-[2rem] border shadow-sm">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 font-bold transition-all">
                    <ArrowLeft size={18} /> 목록으로 돌아가기
                </button>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Viewing:</span>
                    <div className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-black shadow-lg italic">
                        {collectionName}
                    </div>
                </div>
            </div>

            {/* 탭 메뉴 */}
            <div className="flex gap-2 p-1.5 bg-zinc-100 rounded-[1.2rem] w-fit border border-zinc-200 mx-auto">
                <button
                    onClick={() => { setActiveTab("correct"); setPage(1); }}
                    className={`px-10 py-3 rounded-xl text-xs font-black transition-all ${activeTab === "correct" ? "bg-white text-blue-600 shadow-md" : "text-zinc-400 hover:text-zinc-600"}`}
                >
                    CORRECT DATA ({correctItems.length})
                </button>
                <button
                    onClick={() => { setActiveTab("counter"); setPage(1); }}
                    className={`px-10 py-3 rounded-xl text-xs font-black transition-all ${activeTab === "counter" ? "bg-white text-orange-600 shadow-md" : "text-zinc-400 hover:text-zinc-600"}`}
                >
                    COUNTER DATA ({counterItems.length})
                </button>
            </div>

            {/* 리스트 영역 */}
            <div className="grid grid-cols-1 gap-4">
                {pagedItems.length === 0 ? (
                    <div className="bg-white rounded-[2.5rem] py-32 border border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-300">
                        <Sparkles size={48} className="mb-4 opacity-20" />
                        <p className="font-bold uppercase tracking-widest text-sm opacity-50">No data found in this category</p>
                    </div>
                ) : (
                    pagedItems.map((item, idx) => (
                        <div key={idx} className="bg-white p-7 rounded-[2rem] border border-zinc-100 shadow-sm group hover:border-blue-300 transition-all">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="bg-zinc-50 text-zinc-400 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-100 flex items-center gap-1 leading-none">
                                    <Hash size={10} /> {String(item.application_number)}
                                </span>
                            </div>
                            <h4 className="text-lg font-black text-zinc-800 mb-2 group-hover:text-blue-600 transition-colors leading-tight">
                                {String(item.title)}
                            </h4>
                            <p className="text-sm text-zinc-500 leading-relaxed line-clamp-3 font-medium">
                                {String(item.abstract)}
                            </p>
                        </div>
                    ))
                )}
            </div>

            {/* 하단 페이지네이션 */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-6 pt-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="p-3 border rounded-2xl bg-white disabled:opacity-20 hover:bg-zinc-50 transition-all shadow-sm"
                    >
                        <ChevronLeft size={20} />
                    </button>
                    <div className="text-sm font-black text-zinc-900 bg-white px-6 py-2 rounded-full border shadow-sm">
                        <span className="text-blue-600">{page}</span> <span className="text-zinc-300 mx-1">/</span> {totalPages}
                    </div>
                    <button
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                        className="p-3 border rounded-2xl bg-white disabled:opacity-20 hover:bg-zinc-50 transition-all shadow-sm"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
}