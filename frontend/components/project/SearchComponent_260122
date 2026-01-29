// frontend/components/project/SearchComponent.tsx

import React, { useEffect, useMemo, useState } from "react";
import { Search, ShoppingCart, Trash2, Save, Loader2, ChevronDown, ChevronUp, Info, Package, X, Zap, ZapOff } from "lucide-react";
import { CollectionInfo } from "@/types/collection";
import { DataSourceInfo, ProjectInfo } from "@/types/project";
import { ElasticSearchResult } from "@/types/search";

interface SearchComponentProps {
    project: ProjectInfo;
    token: string;
    collections: CollectionInfo[];
    shouldUseCounter: boolean;
    trainingDataItems: any[];
    onTrainingDataUpdate: (items: any[], sourceInfo: DataSourceInfo) => void;
    onCounterDataUpdate: (items: any[]) => void;
    fixedCollectionName?: string;
}

export default function SearchComponent({ project, token, collections, shouldUseCounter, trainingDataItems, onTrainingDataUpdate, onCounterDataUpdate, fixedCollectionName }: SearchComponentProps) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    console.log(">>> shouldUseCounter:", shouldUseCounter)

    // 1. 상태 관리
    const [inputValue, setInputValue] = useState(fixedCollectionName || "");
    const [inputLocked, setInputLocked] = useState(!!fixedCollectionName);
    const [keywords, setKeywords] = useState("");
    const [section, setSection] = useState("");
    const [selectedCollectionCode, setSelectedCollectionCode] = useState("__new__");
    const [searchMethod, setSearchMethod] = useState("bgem3");
    const [searching, setSearching] = useState(false);

    const [results, setResults] = useState<any[]>([]); // 현재 페이지 결과
    const [allFetchedResults, setAllFetchedResults] = useState<any[]>([]); // 전체 데이터 장부
    const [selected, setSelected] = useState<any[]>([]); // 체크박스 선택 리스트
    const [cart, setCart] = useState<any[]>([]); // 장바구니 리스트
    const [autoCollect, setAutoCollect] = useState(shouldUseCounter); // 카운터 데이터 자동수집
    const [isCounterUsed, setIsCounterUsed] = useState(shouldUseCounter); // 카운터 데이터 학습 사용 여부 상태
    const [listTab, setListTab] = useState<"selected" | "unselected">("selected");
    const [excludedUnselectedNums, setExcludedUnselectedNums] = useState<Set<string>>(new Set());

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(5);
    const [totalPages, setTotalPages] = useState(0);
    const [totalHits, setTotalHits] = useState(0);
    const [maxSize, setMaxSize] = useState(0);
    const [openRow, setOpenRow] = useState<number | null>(null);

    useEffect(() => {
        if (fixedCollectionName) {
            setInputValue(fixedCollectionName);
            setInputLocked(true);
        }
    }, [fixedCollectionName]);

    // [함수 1] 검색 및 데이터 누적
    async function doSearch(pageNum: number = 1, isNewSearch: boolean = false) {
        if (!keywords.trim() || !section.trim()) {
            alert("카테고리와 검색어를 확인하세요.");
            return;
        }

        if (isNewSearch) {
            setSelected([]);
            setCart([]);
            setAllFetchedResults([]);
        }

        setSearching(true);
        try {
            const res = await fetch(
                `${API_BASE}/api/search/keyword?section=${section}&keyword=${encodeURIComponent(keywords)}&page=${pageNum}&page_size=${perPage}&method=${searchMethod}&include_vector=true&include_quote=false`
            );
            if (!res.ok) throw new Error("검색 실패");
            const data = await res.json();

            const dataArray = data.data || [];
            const hitsArray = data.hits || [];

            const newResults = dataArray.map((item: any, index: number) => ({
                ...item,
                vector: hitsArray[index]?.vector || null,
                score: hitsArray[index]?.score || item.score,
            }));

            setResults(newResults);

            // 본 데이터 누적 (Counter 데이터 소스)
            setAllFetchedResults(prev => {
                const existingNums = new Set(prev.map(p => p.application_number));
                const uniqueNew = newResults.filter((nr: ElasticSearchResult) => !existingNums.has(nr.application_number));
                return [...prev, ...uniqueNew];
            });

            setSelected([]);

            if (isNewSearch && !inputLocked) {
                setInputValue(keywords.trim().substring(0, 20));
            }

            setPage(data.page || pageNum);
            setTotalHits(data.total_hits || 0);
            setTotalPages(data.total_pages || 0);
            setMaxSize(data.max_size || 0);
        } catch (e: any) {
            alert(e.message || "오류 발생");
        } finally {
            setSearching(false);
        }
    }

    // 카운터(미선택, unselected) 데이터 관련
    // 자동 수집 토글 핸들러
    const toggleCounterMode = () => {
        if (!shouldUseCounter) return;
        const nextVal = !autoCollect;
        setAutoCollect(nextVal);
        setIsCounterUsed(nextVal);
    };

    const unselectedResults = useMemo(() => {
        // 🚀 만약 자동 수집이 꺼져있다면 계산할 필요도 없음
        if (!autoCollect) return [];

        return allFetchedResults.filter(r => {
            const isInCart = cart.some(c => c.application_number === r.application_number);
            const isExcluded = excludedUnselectedNums.has(r.application_number);
            // 🎯 핵심: 부모 리스트(trainingDataItems)에 이미 있는 번호는 무조건 제외
            const isAlreadyRegistered = trainingDataItems.some(t => t.application_number === r.application_number);

            return !isInCart && !isExcluded && !isAlreadyRegistered;
        });
    }, [allFetchedResults, cart, excludedUnselectedNums, trainingDataItems, autoCollect]);

    // 미선택 데이터 목록에서 특정 항목 제외하기
    const removeUnselectedItem = (appNum: string) => {
        setExcludedUnselectedNums(prev => new Set([...prev, appNum]));
    };

    // 대기열(장바구니) 조작 (누락되었던 clearCart 포함)
    function toggleSelect(appNum: string) {
        setSelected(prev => prev.includes(appNum) ? prev.filter(n => n !== appNum) : [...prev, appNum]);
    }

    function toggleSelectAll(checked: boolean) {
        const inCartNums = new Set(cart.map(c => c.application_number));
        setSelected(checked ? results.filter(r => !inCartNums.has(r.application_number)).map(r => r.application_number) : []);
    }

    function addToCart() {
        const toAdd = results.filter(r => selected.includes(r.application_number));
        if (toAdd.length === 0) return;

        setCart(prev => {
            const existing = new Set(prev.map(x => x.application_number));
            const newItems = toAdd.map(item => ({ ...item, collection_name: inputValue }));
            return [...prev, ...newItems.filter(r => !existing.has(r.application_number))];
        });
        setSelected([]);
    }

    function removeFromCart(appNum: string) {
        setCart(prev => prev.filter(r => r.application_number !== appNum));
    }

    // 🎯 누락되었던 함수 정의 (ReferenceError 해결)
    function clearCart() {
        if (confirm("장바구니를 전체 삭제하시겠습니까?")) {
            setCart([]);
        }
    }

    // [함수 3] 최종 저장 및 필드 매핑
    async function saveCart() {
        try {
            let finalCartItems = [...cart];

            if (selected.length > 0) {
                const currentSelected = results.filter(r => selected.includes(r.application_number));
                const newItems = currentSelected.map(item => ({ ...item, collection_name: inputValue }));
                const existingNums = new Set(finalCartItems.map(c => c.application_number));
                finalCartItems = [...finalCartItems, ...newItems.filter(n => !existingNums.has(n.application_number))];
            }

            if (finalCartItems.length === 0) {
                alert("등록할 항목이 없습니다.");
                return;
            }

            if (!confirm(`${finalCartItems.length}개의 항목을 등록하시겠습니까?`)) return;

            const searchKeyword = keywords.trim();
            const collectionName = fixedCollectionName || inputValue.trim() || searchKeyword;

            const correctToSave = finalCartItems.map((item, index) => ({
                id: `search_tr_${Date.now()}_${index}`, // 고유키 생성
                project_id: project.id,
                collection_name: collectionName,
                class_name: item.collection_name,
                title: item.title,
                abstract: item.abstract,
                application_number: item.application_number,
                vector: item.vector,
                score: item.score,
                used: 1
            }));

            if (fixedCollectionName) {
                const payload = {
                    items: correctToSave,
                    n_items: []
                };

                const res = await fetch(`${API_BASE}/api/project/${project.id}/data/add`, { // 해당 API 엔드포인트가 있다고 가정
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(payload),
                });

                if (res.ok) {
                    alert(`'${fixedCollectionName}'에 데이터가 성공적으로 저장되었습니다.`);
                    onTrainingDataUpdate(correctToSave, {
                        sourceId: searchKeyword,
                        name: collectionName,
                        count: correctToSave.length,
                        type: 'search',
                    });
                } else {
                    throw new Error("서버 저장 실패");
                }
            } else {
                onTrainingDataUpdate(correctToSave, {
                    sourceId: searchKeyword,
                    name: collectionName,
                    count: correctToSave.length,
                    isUsed: true,
                    type: 'search',
                    isCounterUsed: isCounterUsed,
                });

                if (autoCollect) {
                    const counterToSave = unselectedResults.map((item, index) => ({
                        id: `search_cntr_${Date.now()}_${index}`,
                        project_id: project.id,
                        collection_name: collectionName,
                        class_name: "COUNTER",
                        title: item.title,
                        abstract: item.abstract,
                        application_number: item.application_number,
                        vector: null,
                        score: item.score,
                        used: 0,

                        sourceId: searchKeyword,
                        sourceName: collectionName,
                    }));
                    onCounterDataUpdate(counterToSave);
                }
            }

            setCart([]);
            setResults([]);
            setAllFetchedResults([]);
            setSelected([]);
            setExcludedUnselectedNums(new Set());

        } catch (e: any) {
            alert("등록 중 오류가 발생했습니다.");
            console.log(e)
        }
    }

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 p-8 space-y-6">

                {/* 편집 모드 시 안내 */}
                {fixedCollectionName && (
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl flex items-center gap-3">
                        <div className="bg-indigo-600 p-1.5 rounded-lg text-white"><Info size={16} /></div>
                        <div>
                            <p className="text-sm font-bold text-indigo-900">'{fixedCollectionName}' 컬렉션 데이터 추가 모드</p>
                            <p className="text-xs text-indigo-600">검색된 데이터는 자동으로 해당 컬렉션 레이블로 지정됩니다.</p>
                        </div>
                    </div>
                )}

                {/* 검색 도구 설정 */}
                <div className="grid gap-2 md:grid-cols-3">
                    <select value={section} onChange={(e) => setSection(e.target.value)} className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 outline-none">
                        <option value="">카테고리 선택</option>
                        <option value="a">A (생활필수품)</option>
                        <option value="b">B (작업, 운수)</option>
                        <option value="c">C (화학, 야금)</option>
                        <option value="d">D (섬유, 종이)</option>
                        <option value="e">E (건설)</option>
                        <option value="f">F (기계공학)</option>
                        <option value="g">G (물리학)</option>
                        <option value="h">H (전기)</option>
                        <option value="y">Y (신기술)</option>
                    </select>
                    <select value={searchMethod} onChange={(e) => setSearchMethod(e.target.value)} className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 outline-none">
                        <option value="bgem3">BGE-M3 (벡터)</option>
                        <option value="mlt">MLT (텍스트)</option>
                    </select>
                    <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 outline-none">
                        <option value="5">5개씩</option>
                        <option value="10">10개씩</option>
                        <option value="20">20개씩</option>
                    </select>
                </div>

                <div className="grid gap-2 md:grid-cols-4">
                    <input value={keywords} onChange={(e) => setKeywords(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && doSearch(1, true)} placeholder="검색어 입력" className="px-4 py-3 border-2 border-zinc-200 rounded-xl md:col-span-3 focus:border-blue-500 outline-none" />
                    <button onClick={() => doSearch(1, true)} disabled={searching} className="bg-blue-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
                        {searching ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />} {searching ? "중..." : "검색"}
                    </button>
                </div>

                {totalHits > 0 && (
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-100 text-sm text-blue-800 flex justify-between shadow-inner">
                        <span>총 <strong>{totalHits.toLocaleString()}</strong>건 매칭 | 페이지: <strong>{page}</strong> / {totalPages}</span>
                        <span className="text-blue-400 opacity-70">최대 {maxSize.toLocaleString()}건 지원</span>
                    </div>
                )}

                <div className="flex items-center gap-3 border border-zinc-200 p-4 rounded-xl bg-zinc-50 shadow-sm">
                    <label className="text-sm font-black text-zinc-700 whitespace-nowrap">컬렉션 명:</label>
                    {!fixedCollectionName ? (
                        <>
                            <select
                                value={section || "__new__"}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSelectedCollectionCode(val);
                                    if (val !== "__new__") {
                                        const col = collections.find(c => c.collection_code === val);
                                        setInputValue(col?.collection_name || "");
                                        setInputLocked(true);
                                    } else {
                                        setInputValue("");
                                        setInputLocked(false);
                                    }
                                }}
                                className="px-3 py-2 border border-zinc-300 rounded-lg text-sm bg-white"
                            >
                                <option value="__new__">+ 직접 입력</option>
                                {collections.map(c =>
                                    <option key={c.id} value={c.collection_code}>{c.collection_name}</option>
                                )}
                            </select>
                            <input
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                disabled={inputLocked}
                                placeholder="새 컬렉션 이름"
                                className="px-3 py-2 border border-zinc-300 rounded-lg text-sm flex-1 disabled:bg-zinc-100 outline-none focus:border-blue-500"
                            />
                        </>
                    ) : (
                        <div className="flex-1 px-3 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-black text-blue-600">
                            {fixedCollectionName}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button onClick={() => toggleSelectAll(true)} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm font-medium">전체 선택</button>
                        <button onClick={() => toggleSelectAll(false)} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 rounded-lg text-sm font-medium">선택 해제</button>
                    </div>
                    <button onClick={addToCart} disabled={selected.length === 0} className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg flex items-center gap-2 shadow-lg shadow-blue-100 active:scale-95 transition-all">
                        <ShoppingCart size={18} /> 담기 ({selected.length})
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-50 border-b">
                            <tr>
                                <th className="p-3 text-left w-10"></th>
                                <th className="p-3 text-left w-12">#</th>
                                <th className="p-3 text-left w-36">출원번호</th>
                                <th className="p-3 text-left font-bold">특허명</th>
                                <th className="p-3 text-left w-24">점수</th>
                                <th className="p-3 text-center w-20">상세</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.length === 0 ? <tr><td colSpan={6} className="p-20 text-center text-zinc-400">검색 결과가 없습니다.</td></tr> :
                                results.map((r, i) => {
                                    const isAdded = cart.some(c => c.application_number === r.application_number);
                                    return (
                                        <React.Fragment key={r.application_number}>
                                            <tr className={`border-b transition-colors ${isAdded ? "bg-zinc-50 opacity-60" : "hover:bg-blue-50"}`}>
                                                <td className="p-3 text-center"><input type="checkbox" checked={selected.includes(r.application_number) || isAdded} onChange={() => !isAdded && toggleSelect(r.application_number)} disabled={isAdded} className="w-4 h-4 cursor-pointer" /></td>
                                                <td className="p-3 text-zinc-500">{(page - 1) * perPage + i + 1}</td>
                                                <td className="p-3 font-mono text-zinc-600">{r.application_number}</td>
                                                <td className="p-3 font-medium text-zinc-800">{r.title}</td>
                                                <td className="p-3 text-blue-600 font-bold">{r.score?.toFixed(3)}</td>
                                                <td className="p-3 text-center">
                                                    <button onClick={() => setOpenRow(openRow === i ? null : i)} className="text-zinc-400 hover:text-blue-600">
                                                        {openRow === i ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {openRow === i && (
                                                <tr className="bg-zinc-50/50">
                                                    <td colSpan={6} className="p-6 text-sm text-zinc-600 border-b leading-relaxed">
                                                        <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-inner space-y-3">
                                                            <p className="text-zinc-800"><strong>초록:</strong> {r.abstract || "요약 정보가 없습니다."}</p>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-zinc-500 pt-3 border-t border-zinc-100">
                                                                <div><strong>출원일:</strong> {r.filing_date || "-"}</div>
                                                                <div><strong>공개번호:</strong> {r.publication_number || "-"}</div>
                                                                <div><strong>등록번호:</strong> {r.grant_number || "-"}</div>
                                                                <div><strong>CPC:</strong> {r.cpc_code || "-"}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-1 mt-6">
                        <button onClick={() => doSearch(page - 1)} disabled={page === 1} className="px-3 py-1.5 border rounded-lg disabled:opacity-30">이전</button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                            if (pageNum <= 0 || pageNum > totalPages) return null;
                            return (
                                <button key={pageNum} onClick={() => doSearch(pageNum)} className={`px-4 py-1.5 border rounded-lg transition-all ${page === pageNum ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'hover:bg-zinc-50 text-zinc-600'}`}>
                                    {pageNum}
                                </button>
                            );
                        })}
                        <button onClick={() => doSearch(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 border rounded-lg disabled:opacity-30">다음</button>
                    </div>
                )}
            </div>

            {/* 장바구니 영역 */}
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                {/* 1. 헤더 영역: 제목 및 오토 컬렉트 토글 */}
                <div className="bg-zinc-50 px-8 py-5 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="text-blue-600 w-6 h-6" />
                        <h3 className="font-bold text-xl text-zinc-900">데이터 등록 대기열</h3>
                    </div>


                    {!fixedCollectionName &&
                        <div className="flex gap-4">
                            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-lg border border-zinc-200">
                                <span className="text-sm font-medium text-zinc-600">미선택 자동 수집</span>
                                <button
                                    onClick={toggleCounterMode}
                                    disabled={shouldUseCounter}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoCollect ? 'bg-emerald-500' : 'bg-zinc-400'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoCollect ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                            <div className={`flex items-center gap-3 bg-white px-4 py-2 rounded-lg border-2 transition-all shadow-sm ${isCounterUsed ? 'border-orange-200 bg-orange-50/30' : 'border-zinc-200'}`}>
                                <div className="flex items-center gap-2">
                                    {isCounterUsed ? <Zap className="w-4 h-4 text-orange-500 fill-orange-500" /> : <ZapOff className="w-4 h-4 text-zinc-400" />}
                                    <span className={`text-sm font-bold ${isCounterUsed ? 'text-orange-700' : 'text-zinc-500'}`}>
                                        미선택 데이터 학습
                                    </span>
                                </div>
                                <button
                                    onClick={toggleCounterMode}
                                    disabled={shouldUseCounter}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isCounterUsed ? 'bg-orange-500' : 'bg-zinc-400'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCounterUsed ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        </div>
                    }

                </div>

                {/* 2. 탭 메뉴: selected와 unselected 전환 */}
                <div className="px-8 pt-5 flex gap-6 border-b border-zinc-100">
                    <button
                        onClick={() => setListTab("selected")}
                        className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${listTab === "selected" ? "border-blue-600 text-blue-600" : "border-transparent text-zinc-400 hover:text-zinc-600"}`}
                    >
                        selected ({cart.length})
                    </button>
                    <button
                        onClick={() => setListTab("unselected")}
                        className={`pb-3 px-2 text-sm font-bold transition-all border-b-2 ${listTab === "unselected" ? "border-orange-600 text-orange-600" : "border-transparent text-zinc-400 hover:text-zinc-600"}`}
                    >
                        unselected ({unselectedResults.length})
                    </button>
                </div>

                {/* 3. 리스트 본문: 탭에 따른 데이터 노출 */}
                <div className="p-8">
                    <div className="max-h-72 overflow-y-auto space-y-2 mb-8 pr-2 custom-scrollbar">
                        {listTab === "selected" ? (
                            /* --- selected 목록 --- */
                            cart.length === 0 ? (
                                <p className="text-center text-zinc-400 py-16">선택된 데이터가 없습니다.</p>
                            ) : (
                                cart.map((r, i) => (
                                    <div key={r.application_number} className="flex justify-between items-center p-3 bg-blue-50/30 rounded-xl border border-blue-100">
                                        <div className="truncate flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-zinc-500 font-mono">{r.application_number}</span>
                                                <div className="text-sm font-bold text-zinc-800 truncate">{r.title}</div>
                                                <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded">{r.collection_name}</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeFromCart(r.application_number)} className="ml-4 p-2 text-zinc-400 hover:text-red-500 transition-colors">
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))
                            )
                        ) : (
                            /* --- unselected 목록 --- */
                            unselectedResults.length === 0 ? (
                                <p className="text-center text-zinc-400 py-16">미선택 데이터가 없습니다.</p>
                            ) : (
                                unselectedResults.map((r, i) => (
                                    <div key={r.application_number} className="flex justify-between items-center p-3 bg-orange-50/30 rounded-xl border border-orange-100">
                                        <div className="truncate flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs text-zinc-500 font-mono">{r.application_number}</span>
                                                <div className="text-sm font-bold text-zinc-800 truncate">{r.title}</div>
                                                <span className="text-[10px] font-black text-orange-600 bg-orange-100 px-2 py-0.5 rounded">COUNTER</span>
                                            </div>
                                        </div>
                                        <button onClick={() => removeUnselectedItem(r.application_number)} className="ml-4 p-2 text-zinc-400 hover:text-red-500 transition-colors">
                                            <X size={20} />
                                        </button>
                                    </div>
                                ))
                            )
                        )}
                    </div>

                    {/* 4. 하단 버튼 영역 */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6 pt-8 border-t border-zinc-100">
                        {/* 데이터 건수 요약 (선택사항) */}
                        <div className="flex gap-4 text-center">
                            <div className="text-xs">
                                <span className="text-zinc-400 font-bold uppercase block mb-1">Total Selected</span>
                                <span className="text-lg font-black text-blue-600">{cart.length}</span>
                            </div>
                            <div className="text-xs border-l border-zinc-200 pl-4">
                                <span className="text-zinc-400 font-bold uppercase block mb-1">Total Unselected</span>
                                <span className="text-lg font-black text-orange-600">{unselectedResults.length}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 w-full md:w-auto">
                            <button
                                onClick={clearCart}
                                className="flex-1 px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl hover:bg-zinc-200 font-bold transition-all"
                            >
                                비우기
                            </button>
                            <button
                                onClick={saveCart}
                                // className="flex-1 px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:shadow-xl shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                                className={`flex-1 px-12 py-4 text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${isCounterUsed && !fixedCollectionName
                                    ? 'bg-gradient-to-r from-orange-600 to-red-600 shadow-orange-100'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-100'
                                    }`}
                            >
                                <Save size={20} />
                                {fixedCollectionName ? "저장하기" : "등록하기"} ({cart.length + (autoCollect ? unselectedResults.length : 0)}건)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}