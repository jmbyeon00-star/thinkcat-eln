// /frontend/components/project/SearchComponent.tsx
import React, { useEffect, useState } from "react";
import { Search, Loader2, Plus, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Zap, ZapOff, Lock } from "lucide-react";
import { CollectionInfo } from "@/types/collection";
import { DataSourceInfo, ProjectInfo } from "@/types/project";

interface SearchComponentProps {
    autoCollect: boolean;
    setAutoCollect: (val: boolean) => void;
    projectInfo: ProjectInfo;
    collections: CollectionInfo[];
    correctDataItems: any[];
    onAdd: (items: any[], counterItems: any[], sourceInfo: DataSourceInfo) => void;
    hasModel: boolean;
    hasCounterClass: boolean;
}

export default function SearchComponent({
    autoCollect, setAutoCollect, projectInfo, collections, correctDataItems,
    onAdd, hasModel, hasCounterClass
}: SearchComponentProps) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [section, setSection] = useState("");
    const [keywords, setKeywords] = useState("");
    const [searchMethod, setSearchMethod] = useState("bgem3");
    const [searching, setSearching] = useState(false);

    const [targetLabel, setTargetLabel] = useState("");
    const [inputMode, setInputMode] = useState<"select" | "manual">("select");

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [openRow, setOpenRow] = useState<number | null>(null);

    const [results, setResults] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [collectionNames, setCollectionNames] = useState<string[]>([]);
    useEffect(() => {
        if (collections) {
            const names: string[] = collections.map((c: any) => c.collection_name);
            setCollectionNames(prev => Array.from(new Set([...names, ...prev])));
        }
    }, [collections]);

    const handleSearch = async (pageNum: number = 1) => {
        if (!section) return alert("카테고리를 먼저 선택해주세요.");
        if (!keywords.trim()) return alert("검색어를 입력해주세요.");

        setSearching(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/search/keyword?section=${section}&keyword=${encodeURIComponent(keywords)}&page=${pageNum}&page_size=10&method=${searchMethod}&include_vector=true`
            );
            const data = await res.json();

            const dataArray = data.data || [];
            const hitsArray = data.hits || [];

            const newResults = dataArray.map((item: any, index: number) => ({
                ...item,
                vector: hitsArray[index]?.vector || null,
                score: hitsArray[index]?.score || item.score,
            }));


            setResults(newResults || []);
            setPage(pageNum);
            setTotalPages(data.total_pages || 1);
            setSelectedIds([]);

            // if (!hasModel && !targetLabel) {
            //     setTargetLabel(keywords.substring(0, 20));
            // }
            if (!hasModel && inputMode === "manual" && !targetLabel) {
                setTargetLabel(keywords.substring(0, 20));
            }

        } catch (e) {
            alert("검색 중 오류 발생");
        } finally { setSearching(false); }
    };

    // SearchComponent.tsx 내부 handleImmediateAdd 수정 예시
    const handleImmediateAdd = () => {
        const finalLabel = targetLabel.trim();
        if (!finalLabel) return alert("레이블 정보를 확인해주세요.");

        if (!collectionNames.includes(finalLabel)) {
            setCollectionNames(prev => [...prev, finalLabel]);
        }

        // 1. 선택된 긍정 데이터 (used: 1)
        const trainItems = results.filter(r => selectedIds.includes(r.application_number)).map(item => ({
            ...item,
            collection_name: finalLabel,
            section: section,
            data_status: 'NEW',
            used: 1
        }));

        // 2. 미선택 부정 데이터 (used: 0)
        let counterItems: any[] = [];
        if (autoCollect) {
            counterItems = results.filter(r =>
                !selectedIds.includes(r.application_number)
                // 중복 체크가 너무 엄격하면 여기서 다 걸러짐. 일단 주석 처리하고 테스트
                // && !correctDataItems.some(t => t.application_number === r.application_number && t.used === 1)
            ).map(item => ({
                ...item,
                collection_name: finalLabel,
                section: null,
                data_status: 'NEW',
                used: 0,
                vector: null
            }));
        }

        // console.log("Adding Data:", { train: trainItems.length, counter: counterItems.length, autoCollect });

        onAdd(trainItems, counterItems, {
            sourceId: keywords,
            name: finalLabel,
            count: trainItems.length,
            type: 'search',
            isCounterUsed: autoCollect
        });

        setSelectedIds([]);
    };
    // 1️⃣ 선택 가능한(이미 추가되지 않은) 데이터 필터링
    const selectableResults = results.filter(r =>
        !correctDataItems.some(li => li.application_number === r.application_number && li.used === 1)
    );

    // 2️⃣ 현재 모두 선택되었는지 여부 판정
    const isAllSelected = selectableResults.length > 0 &&
        selectableResults.every(r => selectedIds.includes(r.application_number));

    // 3️⃣ 전체 선택/해제 핸들러
    const handleToggleAll = () => {
        if (isAllSelected) {
            setSelectedIds([]); // 이미 다 선택됐다면 전체 해제
        } else {
            setSelectedIds(selectableResults.map(r => r.application_number)); // 나머지를 전체 선택
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2 p-2 bg-zinc-50 rounded-2xl border border-zinc-100">
                <select value={section} onChange={e => setSection(e.target.value[0].toLowerCase())} className="bg-white border border-zinc-200 px-3 py-2 rounded-xl text-xs font-black outline-none focus:border-blue-500 transition-all">
                    <option value="">카테고리 선택</option>
                    {[
                        'A(생활필수품)', 'B(작업, 운수)', 'C(화학, 야금)', 'D(섬유, 종이)', 'E(건설)', 'F(기계공학)', 'G(물리학)', 'H(전기)', 'Y(신기술)'
                    ].map(v => (
                        <option key={v} value={v[0].toLowerCase()}>
                            {v}
                        </option>
                    ))}
                </select>
                <select value={searchMethod} onChange={e => setSearchMethod(e.target.value)} className="bg-white border border-zinc-200 px-3 py-2 rounded-xl text-xs font-black outline-none">
                    <option value="bgem3">벡터 검색</option>
                    <option value="mlt">키워드 검색</option>
                </select>
                <div className="flex-1 min-w-[200px] flex gap-2">
                    <input value={keywords} onChange={(e) => setKeywords(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch(1)} placeholder="검색어 입력..." className="flex-1 bg-white border border-zinc-200 px-4 py-2 rounded-xl text-sm outline-none shadow-sm" />
                    <button onClick={() => handleSearch(1)} disabled={searching} className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all">
                        {searching ? <Loader2 className="animate-spin" size={18} /> : <Search size={18} />}
                    </button>
                </div>
            </div>

            <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden shadow-inner h-[380px] flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-zinc-50">
                    {results.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-zinc-300 py-10 opacity-40">
                            <Search size={40} className="mb-2" />
                            <p className="text-[10px] font-black uppercase">Ready to Search</p>
                        </div>
                    ) : (
                        <>
                            {/* ✅ 추가: 전체 선택 헤더 영역 */}
                            <div className="p-4 bg-zinc-50/50 flex items-center gap-4 border-b border-zinc-100 sticky top-0 z-10 backdrop-blur-sm">
                                <input
                                    type="checkbox"
                                    checked={isAllSelected}
                                    onChange={handleToggleAll}
                                    className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                                />
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                                    전체 선택 ({selectableResults.length}건)
                                </span>
                            </div>
                            {results.map((r, i) => {
                                const isCorrectAdded = correctDataItems.some(li => li.application_number === r.application_number && li.used === 1);
                                return (
                                    <div key={r.application_number} className={`p-4 flex items-center gap-4 transition-all ${isCorrectAdded ? 'opacity-30 bg-zinc-50' : 'hover:bg-blue-50/30'}`}>
                                        <input
                                            type="checkbox"
                                            disabled={isCorrectAdded}
                                            checked={selectedIds.includes(r.application_number) || isCorrectAdded}
                                            onChange={() => setSelectedIds(p => p.includes(r.application_number) ? p.filter(id => id !== r.application_number) : [...p, r.application_number])}
                                            className="w-5 h-5 rounded-lg accent-blue-600 cursor-pointer"
                                        />
                                        <div className="flex-1 min-w-0" onClick={() => !isCorrectAdded && setOpenRow(openRow === i ? null : i)}>
                                            <div className="text-sm font-bold text-zinc-800 truncate">{String(r.title)}</div>
                                            <div className="text-[10px] text-zinc-400 font-mono mt-1">{String(r.application_number)}</div>
                                        </div>
                                        <button onClick={() => setOpenRow(openRow === i ? null : i)} className="text-zinc-300">
                                            {openRow === i ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </button>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="p-2 bg-zinc-50 border-t border-zinc-100 flex justify-center items-center gap-4 text-[10px] font-black text-zinc-400">
                        <button onClick={() => handleSearch(page - 1)} disabled={page === 1} className="disabled:opacity-20"><ChevronLeft size={14} /></button>
                        <span>{page} / {totalPages}</span>
                        <button onClick={() => handleSearch(page + 1)} disabled={page === totalPages} className="disabled:opacity-20"><ChevronRight size={14} /></button>
                    </div>
                )}
            </div>

            {/* 레이블 입력 및 선택 영역 */}
            <div className="bg-zinc-50 p-6 rounded-[2rem] border border-zinc-200 space-y-5 shadow-sm font-sans mt-4">

                {/* 미선택 자동 수집 토글 */}
                <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${autoCollect ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-zinc-300'}`} />
                        <span className="text-[11px] font-black text-zinc-600 uppercase tracking-tight">미선택 데이터 자동 수집 {autoCollect ? '켜짐' : '꺼짐'}</span>
                        <button
                            type="button"
                            onClick={() => !hasModel && setAutoCollect(!autoCollect)}
                            disabled={hasModel}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hasModel ? 'opacity-50 cursor-not-allowed' : ''} ${autoCollect ? 'bg-orange-500' : 'bg-zinc-300'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCollect ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                {/* 레이블 입력 및 추가 버튼 영역 */}
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className={`flex-1 flex items-center gap-3 px-4 py-3 rounded-2xl border bg-white transition-all ${hasModel ? 'border-zinc-100 bg-zinc-50' : 'border-zinc-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-50'}`}>
                            <div className="flex items-center gap-2 border-r pr-3 text-zinc-400">
                                <Plus size={14} />
                                <span className="text-[10px] font-black uppercase tracking-widest">Label</span>
                            </div>
                            <input
                                value={targetLabel}
                                onChange={e => !hasModel && setTargetLabel(e.target.value)}
                                readOnly={hasModel}
                                placeholder={hasModel ? "아래 컬렉션 중 하나를 선택하세요" : "레이블 명칭 직접 입력 또는 선택..."}
                                className={`flex-1 bg-transparent text-sm font-bold outline-none ${hasModel ? 'text-zinc-400 cursor-not-allowed' : 'text-zinc-900'} placeholder:text-zinc-300`}
                            />
                        </div>

                        <button
                            onClick={handleImmediateAdd}
                            disabled={selectedIds.length === 0 || searching || !targetLabel.trim()}
                            className={`px-8 py-3 rounded-2xl font-black text-xs uppercase text-white shadow-lg active:scale-95 disabled:opacity-20 transition-all shrink-0 ${autoCollect ? 'bg-orange-600 shadow-orange-100' : 'bg-blue-600 shadow-blue-100'
                                }`}
                        >
                            {selectedIds.length}건 추가
                        </button>
                    </div>

                    {/* 프로젝트 기존 컬렉션 칩 리스트 (토글 방식) */}
                    {collectionNames.length > 0 && (
                        <div className="flex flex-wrap gap-2 px-1">
                            <span className="text-[9px] font-black text-zinc-400 uppercase self-center mr-2 font-sans">Existing:</span>
                            {collectionNames.map((name: string) => {
                                const isSelected = targetLabel === name;
                                return (
                                    <button
                                        key={name}
                                        type="button"
                                        onClick={() => setTargetLabel(isSelected ? "" : name)}
                                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${isSelected
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-md'
                                            : 'bg-white border-zinc-200 text-zinc-500 hover:border-blue-400 hover:text-blue-600'
                                            }`}
                                    >
                                        {name}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}