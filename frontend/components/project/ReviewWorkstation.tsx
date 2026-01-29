import React, { useMemo, useState, useCallback } from "react";
import {
    CheckCircle2, AlertCircle, Tag, Trash2,
    Sparkles, ChevronLeft, ChevronRight, Eraser,
    MonitorSmartphone, Lock
} from "lucide-react";

interface ReviewWorkstationProps {
    items: any[];
    onItemsUpdate: (items: any[]) => void;
    onCleanUp?: () => void;
    onRemove: (appNum: string) => void;
    onLabelChange: (appNum: string, newLabel: string) => void;
    duplicateCount?: number; // 전체 중복 건수
    collectionInfo: any[];
    autoCollect: boolean;
    hasModel: boolean;
    hasCounterClass: boolean; // autoCollect 토글 상태
    sourceType?: string;      // 🎯 추가: 프로젝트 소스 타입 (search 여부 확인용)
}

export default function ReviewWorkstation({
    items, onItemsUpdate, duplicateCount = 0, onCleanUp, onRemove, onLabelChange, collectionInfo, autoCollect, hasModel, hasCounterClass, sourceType
}: ReviewWorkstationProps) {
    console.log("sourceType:", sourceType)
    const [activeTab, setActiveTab] = useState<"correct" | "counter">("correct");
    const [itemPage, setItemPage] = useState(1);
    const itemsPerPage = 5;

    const getUniqueKey = useCallback((item: any) => {
        const title = String(item.title || "").trim();
        const abstract = String(item.abstract || "").trim();
        const appNum = String(item.application_number || "").trim();
        return appNum ? `ID:${appNum}_T:${title}_A:${abstract}` : `T:${title}_A:${abstract}`;
    }, []);

    // 🎯 [핵심] 대시보드용 통계 계산 (DB + 바구니 합집합)
    // const requirementStats = useMemo(() => {
    //     const dbNames = (collectionInfo || []).map((c: any) => c.collection_name);
    //     const basketNames = items.map((i: any) => i.collection_name);
    //     const allNames = Array.from(new Set([...dbNames, ...basketNames])).filter(Boolean);

    //     return allNames.map(name => {
    //         const filtered = items.filter((i: any) => String(i.collection_name) === String(name));
    //         const keys = filtered.map(item => getUniqueKey(item));
    //         const uniqueKeysCount = new Set(keys).size;

    //         // 🎯 레이블별 개별 중복 건수
    //         const labelDuplicateCount = filtered.length - uniqueKeysCount;

    //         const correctCount = filtered.filter((i: any) => Number(i.used) === 1).length;
    //         const counterCount = filtered.filter((i: any) => Number(i.used) === 0).length;

    //         const correctOk = correctCount >= 10;
    //         // 검색 프로젝트가 아니거나, 토글이 꺼져있으면 Counter는 무조건 OK
    //         const counterOk = (sourceType === "search" && hasCounterClass) ? (counterCount >= 10) : true;

    //         return {
    //             name,
    //             correct: { count: correctCount, isOk: correctOk, percent: Math.min((correctCount / 10) * 100, 100) },
    //             counter: { count: counterCount, isOk: counterOk, percent: Math.min((counterCount / 10) * 100, 100) },
    //             duplicateCount: labelDuplicateCount,
    //             isAllOk: correctOk && counterOk
    //         };
    //     });
    // }, [items, collectionInfo, hasCounterClass, sourceType, getUniqueKey]);

    const requirementStats = useMemo(() => {
        const dbNames = (collectionInfo || []).map((c: any) => String(c.collection_name));
        const basketNames = items.map((i: any) => String(i.collection_name));
        const allNames = Array.from(new Set([...dbNames, ...basketNames])).filter(Boolean);

        return allNames.map(name => {
            const filtered = items.filter((i: any) => String(i.collection_name) === name);
            const isExisting = dbNames.includes(name);

            // 🎯 모델이 있는데 DB에 없는 레이블이면 "금지됨"
            const isNew = !isExisting;
            const isForbidden = hasModel && isNew;

            const keys = filtered.map(item => getUniqueKey(item));
            const uniqueKeysCount = new Set(keys).size;
            const labelDuplicateCount = filtered.length - uniqueKeysCount;

            const correctCount = filtered.filter((i: any) => Number(i.used) === 1).length;
            const counterCount = filtered.filter((i: any) => Number(i.used) === 0).length;

            const correctOk = correctCount >= 10;
            const counterOk = (sourceType === "search" && hasCounterClass) ? (counterCount >= 10) : true;

            return {
                name,
                isNew,
                isForbidden, // 🎯 추가
                correct: { count: correctCount, isOk: correctOk, percent: Math.min((correctCount / 10) * 100, 100) },
                counter: { count: counterCount, isOk: counterOk, percent: Math.min((counterCount / 10) * 100, 100) },
                duplicateCount: labelDuplicateCount,
                // 🎯 금지된 레이블이 아닐 때만 AllOk 통과
                isAllOk: correctOk && counterOk && !isForbidden
            };
        });
    }, [items, collectionInfo, hasCounterClass, sourceType, hasModel, getUniqueKey]);


    // 리스트 표시용 페이징 로직
    const processedItems = useMemo(() => {
        const counts = new Map();
        items.forEach(item => {
            const key = getUniqueKey(item);
            counts.set(key, (counts.get(key) || 0) + 1);
        });
        return items.map(item => ({ ...item, isDuplicate: counts.get(getUniqueKey(item)) > 1 }));
    }, [items, getUniqueKey]);

    const displayItems = activeTab === "correct"
        ? processedItems.filter(i => Number(i.used) === 1)
        : processedItems.filter(i => Number(i.used) === 0);

    const itemTotalPages = Math.ceil(displayItems.length / itemsPerPage) || 1;
    const currentPagedItems = displayItems.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage);

    return (
        <div className="space-y-10 animate-in fade-in duration-500">

            {/* 🎯 [교체 완료] 실시간 데이터 품질 대시보드 */}
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl space-y-8">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                            <MonitorSmartphone size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase leading-none">보강 데이터 현황</h2>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">Real-time Quality Check</p>
                        </div>
                    </div>

                    {/* 중복 제거 버튼 (UI 개선) */}
                    {(duplicateCount ?? 0) > 0 && (
                        <button onClick={onCleanUp} className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-2xl text-[11px] font-black hover:bg-orange-600 transition-all shadow-lg animate-in zoom-in">
                            <Eraser size={14} /> 전체 중복 {duplicateCount}건 정리
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {requirementStats.map(stat => (
                        <div key={stat.name} className={`p-5 rounded-[2rem] border-2 transition-all ${stat.isAllOk ? 'bg-white border-green-100 shadow-sm' : 'bg-orange-50/30 border-orange-100'}`}>
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Tag size={14} className={stat.isAllOk ? 'text-green-500' : 'text-orange-500'} />
                                    <span className="text-xs font-black text-zinc-800 truncate">{stat.name}</span>
                                </div>
                                {stat.duplicateCount > 0 && (
                                    <span className="px-2 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded-full animate-pulse whitespace-nowrap">중복 {stat.duplicateCount}</span>
                                )}
                            </div>

                            <div className="space-y-3">
                                {/* Correct Bar */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-[9px] font-black uppercase">
                                        <span>Correct</span>
                                        <span className={stat.correct.isOk ? 'text-green-600' : 'text-orange-600'}>{stat.correct.count}/10</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                        <div className="h-full transition-all duration-700" style={{ width: `${stat.correct.percent}%`, backgroundColor: stat.correct.isOk ? '#22c55e' : '#f97316' }} />
                                    </div>
                                </div>

                                {/* Counter Bar (검색 프로젝트일 때만 노출) */}
                                {sourceType === "search" && (
                                    <div className={`space-y-1 transition-opacity ${!autoCollect ? 'opacity-30' : 'opacity-100'}`}>
                                        <div className="flex justify-between text-[9px] font-black uppercase">
                                            <span>Counter</span>
                                            <span className={stat.counter.isOk ? 'text-green-600' : 'text-orange-600'}>{stat.counter.count}/10</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <div className="h-full transition-all duration-700" style={{ width: `${stat.counter.percent}%`, backgroundColor: hasCounterClass ? (stat.counter.isOk ? '#f97316' : '#fdba74') : '#d4d4d8' }} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {requirementStats.length === 0 && (
                    <div className="pt-8 pb-4 text-center text-zinc-300 border-t border-dashed border-zinc-100 font-black uppercase text-[10px] tracking-widest flex flex-col items-center gap-2">
                        <Sparkles size={24} className="opacity-20" /> No data objects in staging
                    </div>
                )}
            </div>

            {/* 하단 리스트 영역 (기존 코드 유지) */}
            {sourceType === "search" && <div className="bg-zinc-50/50 p-2 rounded-[3.5rem] border border-zinc-100">
                <div className="flex gap-2 p-4 bg-white/80 backdrop-blur rounded-[2.5rem] border border-zinc-100 mb-6 w-fit mx-auto shadow-sm">
                    <button onClick={() => { setActiveTab("correct"); setItemPage(1); }} className={`px-10 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === "correct" ? "bg-blue-600 text-white shadow-lg" : "text-zinc-400"}`}>
                        CORRECT ({processedItems.filter(i => Number(i.used) === 1).length})
                    </button>
                    <button onClick={() => { setActiveTab("counter"); setItemPage(1); }} className={`px-10 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === "counter" ? "bg-white text-orange-600 border border-orange-100 shadow-sm" : "text-zinc-400"}`}>
                        COUNTER ({processedItems.filter(i => Number(i.used) === 0).length})
                    </button>
                </div>

                <div className="space-y-4 px-4 pb-10">
                    {currentPagedItems.map((item) => (
                        <div key={getUniqueKey(item)} className={`bg-white p-6 rounded-[2rem] border transition-all flex items-start gap-8 relative group ${item.isDuplicate ? 'border-red-400 ring-2 ring-red-50' : 'border-zinc-100 hover:border-blue-200 shadow-sm'}`}>
                            {item.isDuplicate && (
                                <div className="absolute -top-3 left-10 bg-red-600 text-white px-3 py-1 rounded-full text-[9px] font-black animate-pulse">중복 데이터</div>
                            )}
                            <div className="flex-none w-48">
                                {hasModel ? (
                                    <div className="w-full text-[11px] font-black p-3.5 bg-zinc-50 text-zinc-400 border border-zinc-100 rounded-xl flex items-center justify-center gap-2">
                                        <Lock size={12} /> {item.collection_name}
                                    </div>
                                ) : (
                                    <select value={item.collection_name} onChange={(e) => onLabelChange(item.application_number, e.target.value)} className="w-full text-[11px] font-black p-3.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl outline-none cursor-pointer hover:bg-blue-100">
                                        {collectionInfo.map((c: any) => <option key={c.id} value={c.collection_name}>{c.collection_name}</option>)}
                                        {!collectionInfo.some(c => c.collection_name === item.collection_name) && <option value={item.collection_name}>{item.collection_name} (New)</option>}
                                    </select>
                                )}
                                <div className={`mt-4 text-[9px] font-black text-center uppercase py-1.5 rounded-full border tracking-widest ${Number(item.used) === 1 ? 'text-blue-500 border-blue-100 bg-blue-50/50' : 'text-orange-500 border-orange-100 bg-orange-50/50'}`}>
                                    {Number(item.used) === 1 ? 'Correct' : 'Counter'}
                                </div>
                            </div>
                            <div className="flex-1 min-w-0 pt-1">
                                <h4 className="text-lg font-bold text-zinc-900 truncate leading-none mb-2 tracking-tight">{item.title}</h4>
                                <div className="text-[11px] text-zinc-400 font-mono mt-2">{item.application_number}</div>
                                <p className="text-sm text-zinc-500 mt-4 line-clamp-2 italic leading-relaxed">{item.abstract}</p>
                            </div>
                            <button onClick={() => onRemove(item.application_number)} className="p-3 text-zinc-200 hover:text-red-500 self-center transition-all hover:bg-red-50 rounded-2xl active:scale-90"><Trash2 size={24} /></button>
                        </div>
                    ))}
                </div>

                {itemTotalPages > 1 && (
                    <div className="p-6 bg-white border-t border-zinc-100 flex justify-center items-center gap-10 rounded-b-[3.5rem]">
                        <button onClick={() => setItemPage(p => Math.max(1, p - 1))} disabled={itemPage === 1} className="p-4 border-2 border-zinc-100 rounded-2xl disabled:opacity-20 hover:bg-zinc-50 transition-all"><ChevronLeft size={20} /></button>
                        <div className="text-sm font-black text-blue-600 tracking-widest uppercase">{itemPage} / {itemTotalPages}</div>
                        <button onClick={() => setItemPage(p => Math.min(itemTotalPages, p + 1))} disabled={itemPage === itemTotalPages} className="p-4 border-2 border-zinc-100 rounded-2xl disabled:opacity-20 hover:bg-zinc-50 transition-all"><ChevronRight size={20} /></button>
                    </div>
                )}
            </div>}
        </div>
    );
}