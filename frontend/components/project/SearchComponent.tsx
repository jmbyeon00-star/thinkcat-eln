// frontend/components/project/SearchComponent.tsx

import React, { useState } from "react";
import { Search, ShoppingCart, Trash2, Save, Loader2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { useRouter } from "next/router";
import { CollectionInfo } from "@/types/collection";
import { DataSourceInfo, ProjectInfo } from "@/types/project";

interface SearchComponentProps {
    // project: ProjectInfo[];
    project: ProjectInfo;
    token: string;
    collections: CollectionInfo[];
    onTrainingDataUpdate: (items: any[], sourceInfo: DataSourceInfo) => void;
    onCounterDataUpdate: (items: any[]) => void;
}

export default function SearchComponent({ project, token, collections, onTrainingDataUpdate, onCounterDataUpdate }: SearchComponentProps) {
    const router = useRouter();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [inputValue, setInputValue] = useState("");
    const [inputLocked, setInputLocked] = useState(false);
    const [section, setSection] = useState("");
    const [keywords, setKeywords] = useState("");
    const [searchMethod, setSearchMethod] = useState("bgem3");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [selected, setSelected] = useState<any[]>([]);
    const [notSelected, setNotSelected] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);

    // 페이지네이션 관련 상태
    const [total, setTotal] = useState(0);
    const [totalHits, setTotalHits] = useState(0);
    const [maxSize, setMaxSize] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(5);
    const [totalPages, setTotalPages] = useState(0);

    const [openRow, setOpenRow] = useState<number | null>(null);

    async function doSearch(pageNum: number = 1) {
        if (pageNum === 1) {
            setSelected([]);
        }
        if (!keywords.trim()) {
            alert("검색 키워드를 입력하세요.");
            return;
        }
        if (!section.trim()) {
            alert("카테고리를 선택하세요.");
            return;
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

            const autoCollectionName = keywords.trim().substring(0, 20);

            const newResults = dataArray.map((item: any, index: number) => {
                const hit = hitsArray[index] || {};
                return {
                    ...item,
                    vector: hit.vector || null,
                    score: hit.score || item.score,
                    collection_name: autoCollectionName,
                };
            });

            const filteredResults = newResults.filter((r: any) => !cart.some((c) => c.application_number === r.application_number));
            setResults(filteredResults);

            if (!inputLocked) {
                setInputValue(autoCollectionName);
            }

            setTotal(data.data?.length || 0);
            setTotalHits(data.total_hits || 0);
            setMaxSize(data.max_size || 0);
            setPage(data.page || pageNum);
            setTotalPages(data.total_pages || 0);
        } catch (e: any) {
            alert(e.message || "검색 실패");
        } finally {
            setSearching(false);
        }
    }

    function toggleSelect(appNum: string) {
        setSelected((prev) => prev.includes(appNum) ? prev.filter((n) => n !== appNum) : [...prev, appNum]);
    }

    function toggleSelectAll(checked: boolean) {
        setSelected(checked ? results.map((r) => r.application_number) : []);
    }

    function addToCart() {
        const newItems = results.filter((r) => selected.includes(r.application_number));
        if (newItems.length === 0) return;

        const collectionStats = new Map<string, number>();
        newItems.forEach((item) => {
            const name = item.collection_name || "(미지정)";
            collectionStats.set(name, (collectionStats.get(name) || 0) + 1);
        });

        const collectionCount = collectionStats.size;
        const collectionDetails = Array.from(collectionStats.entries())
            .map(([name, count]) => `  • ${name}: ${count}개`)
            .join('\n');

        // const message = `총 ${collectionCount}개의 컬렉션으로 ${newItems.length}개 항목을 담습니다.\n\n${collectionDetails}\n\n계속하시겠습니까?`;
        // if (!confirm(message)) return;

        setCart((prev) => {
            const existing = new Set(prev.map((x) => x.application_number));
            return [...prev, ...newItems.filter((r) => !existing.has(r.application_number))];
        });
        const remaining = results.filter((r) => !selected.includes(r.application_number));
        setResults(remaining);
        setNotSelected((prev) => {
            const existing = new Set(prev.map((x) => x.application_number));
            const filteredPrev = prev.filter((r) => !newItems.some((ni) => ni.application_number === r.application_number));
            return [...filteredPrev, ...remaining.filter((r) => !existing.has(r.application_number))];
        });
        setSelected([]);
    }

    function removeFromCart(appNum: string) {
        const item = cart.find((r) => r.application_number === appNum);
        if (item) {
            setCart((prev) => prev.filter((r) => r.application_number !== appNum));
            setResults((prev) => {
                const withoutDup = prev.filter((r) => r.application_number !== appNum);
                return [item, ...withoutDup];
            });
        }
    }

    function clearCart() {
        if (!confirm("카트를 전체 삭제하시겠습니까?")) return;
        setResults((prev) => {
            const cartAppNums = new Set(cart.map((r) => r.application_number));
            const withoutDup = prev.filter((r) => !cartAppNums.has(r.application_number));
            return [...cart, ...withoutDup];
        });
        setCart([]);
    }

    async function saveCart() {
        try {
            if (!confirm("선택한 항목을 등록하시겠습니까?")) return;

            if (!token) {
                alert("인증 정보가 없습니다. 다시 로그인해주세요.");
                return;
            }

            if (cart.length === 0) return;

            // 🎯 1. 소스 정보 구성
            // 검색 결과를 등록할 때 사용했던 검색 키워드와 개수를 사용합니다.
            const searchKeyword = keywords.trim(); // 검색 쿼리를 이름으로 사용
            const collectionName = cart[0]?.collection_name || searchKeyword; // 첫 번째 항목의 collection_name을 최종 소스 이름으로 사용

            // const trinaingItemsToSave = cart;
            const trinaingItemsToSave = cart.map((item, index) => ({
                id: `search_${index}`,  // 개별 ID
                sourceId: searchKeyword,                           // 소스 ID (검색 키워드)
                sourceName: collectionName,                        // 소스 이름
                title: item.title,
                abstract: item.abstract,
                label: item.collection_name,
                application_number: item.application_number,
                score: item.score,
                vector: item.vector
            }));

            const counterItemsToSave = results.map((item, index) => ({
                id: `search_${index}`,  // 개별 ID
                sourceId: searchKeyword,                           // 소스 ID (검색 키워드)
                sourceName: collectionName,                        // 소스 이름
                title: item.title,
                abstract: item.abstract,
                label: item.collection_name,
                application_number: item.application_number,
                score: item.score,
            }));


            // DataSummary 업데이트
            const sourceInfo: DataSourceInfo = {
                sourceId: searchKeyword, // 검색 키워드를 고유 ID로 사용
                name: collectionName,
                count: trinaingItemsToSave.length,
                isUsed: true,
                type: 'search', // 검색 데이터로 명시
            };

            // 🎯 2. 상위 컴포넌트로 데이터 항목과 소스 정보 동시 전달
            // onTrainingDataUpdate 이제 items:any[] 대신 (items:any[], sourceInfo: DataSourceInfo)를 받습니다.
            // onTrainingDataUpdate(prev => [...prev, ...cart]);  <-- 기존 로직 (TrainingDataItems에만 추가)
            onTrainingDataUpdate(trinaingItemsToSave, sourceInfo); // <-- 수정된 로직 (TrainingDataItems + DataSummary에 추가)
            setCart([]);

            onCounterDataUpdate(counterItemsToSave); // <-- 수정된 로직 (TrainingDataItems + DataSummary에 추가)
            setResults([]);

            // router.push 대신 학습 설정 플로우를 이어가야 합니다.

            // Legacy
            // const res = await fetch(`${API_BASE}/api/project/${project.id}/insert`, {
            //     method: "POST",
            //     headers: {
            //         "Content-Type": "application/json",
            //         Authorization: `Bearer ${token}`
            //     },
            //     credentials: "include",
            //     body: JSON.stringify({
            //         source_type: project?.source_type,
            //         project_code: project?.project_code,
            //         project_name: project?.project_name,
            //         project_desc: project?.project_description,
            //         application_numbers: cart.map((r) => r.application_number),
            //         title: cart.map((r) => r.title),
            //         abstract: cart.map((r) => r.abstract),
            //         collection_name: cart.map((r) => r.collection_name),
            //         vector: cart.map((r) => r.vector || null),
            //         n_application_number: notSelected.map((r) => r.application_number),
            //         n_title: notSelected.map((r) => r.title),
            //         n_abstract: notSelected.map((r) => r.abstract),
            //         n_collection_name: notSelected.map((r) => r.collection_name),
            //         n_vector: notSelected.map((r) => r.vector || null),
            //     }),
            // });
            // if (!res.ok) throw new Error("등록 실패");
            // alert("등록 완료!");
            // setCart([]);
            // router.push(`/project/preview/${project.id}`);
        } catch (e: any) {
            alert(e.message || "등록 중 오류 발생");
        }
    }

    return (
        <div className="space-y-6">
            {/* Search Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                <div className="p-8 space-y-6">
                    {/* Search Inputs */}
                    <div className="grid gap-2 md:grid-cols-3">
                        <select
                            value={section}
                            onChange={(e) => setSection(e.target.value)}
                            className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        >
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
                        <select
                            value={searchMethod}
                            onChange={(e) => setSearchMethod(e.target.value)}
                            className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        >
                            <option value="bgem3">BGE-M3 (벡터)</option>
                            <option value="mlt">MLT (텍스트)</option>
                        </select>
                        <select
                            value={perPage}
                            onChange={(e) => setPerPage(Number(e.target.value))}
                            className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                        >
                            <option value="10">10개씩</option>
                            <option value="20">20개씩</option>
                            <option value="50">50개씩</option>
                            <option value="100">100개씩</option>
                        </select>
                    </div>

                    <div className="grid gap-2 md:grid-cols-4">
                        <input
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && doSearch(1)}
                            placeholder="검색어 입력"
                            className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all md:col-span-3"
                        />
                        <button
                            onClick={() => doSearch(1)}
                            disabled={searching}
                            // className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center justify-center gap-2"
                            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center justify-center gap-2 md:col-span-1"
                        >
                            {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                            {searching ? "검색중..." : "검색"}
                        </button>
                    </div>

                    {/* Search Info */}
                    {totalHits > 0 && (
                        <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                            <p className="text-sm text-blue-900">
                                총 <strong className="text-blue-600">{totalHits.toLocaleString()}</strong>건 매칭
                                (최대 <strong className="text-blue-600">{maxSize.toLocaleString()}</strong>건 검색 가능)
                                <span className="mx-2">|</span>
                                페이지: <strong className="text-blue-600">{page}</strong> / {totalPages}
                                <span className="mx-2">|</span>
                                방법: <strong className="text-blue-600">{searchMethod.toUpperCase()}</strong>
                            </p>
                        </div>
                    )}

                    {/* Collection Name Input */}
                    <div className="flex items-center gap-3 border border-zinc-200 p-4 rounded-xl bg-zinc-50">
                        <label className="text-sm font-medium text-zinc-700">컬렉션 명:</label>

                        <select
                            value={section || "__new__"}
                            onChange={(e) => {
                                const val = e.target.value;   // ← 여기의 val은 collection_code 또는 "__new__"
                                setSection(val);

                                if (val !== "__new__") {
                                    // 1) 선택한 collection 찾기
                                    const selected = collections.find(c => c.collection_code === val);

                                    // 2) collection_name 추출
                                    const selectedName = selected?.collection_name || "";

                                    // 3) 검색 결과에 라벨 적용
                                    setResults(prev =>
                                        prev.map(r => ({
                                            ...r,
                                            collection_name: selectedName,
                                        }))
                                    );

                                    setInputValue(selectedName);
                                    setInputLocked(true);
                                } else {
                                    // 직접 입력 모드
                                    setInputValue("");
                                    setInputLocked(false);

                                    setResults(prev =>
                                        prev.map(r => ({
                                            ...r,
                                            collection_name: "",
                                        }))
                                    );
                                }
                            }}
                            className="px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                        >
                            <option value="__new__">+ 직접 입력</option>

                            {collections.map((c) => (
                                <option key={c.id} value={c.collection_code}>
                                    {c.collection_name}
                                </option>
                            ))}
                        </select>

                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInputValue(val);
                                setResults((prev) => prev.map((r) => ({ ...r, collection_name: val })));
                            }}
                            placeholder="새 콜렉션 이름 입력"
                            disabled={inputLocked}
                            className={`px-3 py-2 border border-zinc-300 rounded-lg text-sm flex-1 ${inputLocked ? "bg-zinc-100 text-zinc-500" : "bg-white"
                                }`}
                        />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2 flex-wrap">
                            <button
                                onClick={() => toggleSelectAll(true)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-all"
                            >
                                전체 선택 ({results.length})
                            </button>
                            <button
                                onClick={() => toggleSelectAll(false)}
                                className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 text-sm font-medium transition-all"
                            >
                                전체 해제
                            </button>
                        </div>
                        <button
                            onClick={addToCart}
                            disabled={selected.length === 0}
                            className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center gap-2"
                        >
                            <ShoppingCart className="w-5 h-5" />
                            담기 ({selected.length})
                        </button>
                    </div>

                    {/* Results Table */}
                    <div className="overflow-hidden rounded-xl border-2 border-zinc-200">
                        <table className="w-full">
                            <thead className="bg-zinc-50">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={results.length > 0 && results.every((r) => selected.includes(r.application_number))}
                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">#</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">출원번호</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">특허명</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">점수</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">라벨</th>
                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {searching ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                            검색 중...
                                        </td>
                                    </tr>
                                ) : results.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                                            검색 결과가 없습니다.
                                        </td>
                                    </tr>
                                ) : (
                                    results.map((r, i) => (
                                        <React.Fragment key={r.application_number || i}>
                                            <tr className="border-t border-zinc-200 hover:bg-blue-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.includes(r.application_number)}
                                                        onChange={() => toggleSelect(r.application_number)}
                                                        className="w-4 h-4"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-sm">{(page - 1) * perPage + i + 1}</td>
                                                <td className="px-4 py-3 text-sm font-mono">{r.application_number}</td>
                                                <td className="px-4 py-3 text-sm">{r.title}</td>
                                                <td className="px-4 py-3 text-sm font-mono text-blue-600 font-semibold">
                                                    {r.score?.toFixed(3)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        value={r.collection_name || ""}
                                                        onChange={(e) => setResults((prev) => prev.map((item) =>
                                                            item.application_number === r.application_number
                                                                ? { ...item, collection_name: e.target.value }
                                                                : item
                                                        ))}
                                                        className="w-full px-2 py-1 border border-zinc-300 rounded-lg text-sm"
                                                        placeholder="라벨 입력"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setOpenRow(openRow === i ? null : i)}
                                                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium"
                                                    >
                                                        {openRow === i ? (
                                                            <>
                                                                <ChevronUp size={16} />
                                                                닫기
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown size={16} />
                                                                보기
                                                            </>
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                            {openRow === i && (
                                                <tr className="bg-blue-50">
                                                    <td colSpan={7} className="px-4 py-4 text-sm text-zinc-600 leading-relaxed">
                                                        <div className="space-y-2">
                                                            <div><strong>초록:</strong> {r.abstract || "요약이 없습니다."}</div>
                                                            <div><strong>출원일:</strong> {r.filing_date || "-"}</div>
                                                            <div><strong>등록일:</strong> {r.grant_date || "-"}</div>
                                                            <div><strong>CPC 코드:</strong> {r.cpc_code || "-"}</div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button
                                onClick={() => doSearch(1)}
                                disabled={page === 1}
                                className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all"
                            >
                                «
                            </button>
                            <button
                                onClick={() => doSearch(page - 1)}
                                disabled={page === 1}
                                className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all"
                            >
                                이전
                            </button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                return pageNum <= totalPages ? (
                                    <button
                                        key={pageNum}
                                        onClick={() => doSearch(pageNum)}
                                        className={`px-3 py-2 border-2 rounded-lg transition-all ${page === pageNum
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-zinc-200 hover:bg-zinc-50'
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                ) : null;
                            })}
                            <button
                                onClick={() => doSearch(page + 1)}
                                disabled={page === totalPages}
                                className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all"
                            >
                                다음
                            </button>
                            <button
                                onClick={() => doSearch(totalPages)}
                                disabled={page === totalPages}
                                className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all"
                            >
                                »
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Cart Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                {/* <div className="bg-gradient-to-r px-8 pt-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-semibold">선택한 특허</h3>
                        </div>
                        <span className="px-4 py-2 bg-white/20 rounded-full text-white font-bold">{cart.length}개</span>
                    </div>
                </div> */}
                <div className="p-8">
                    {cart.length === 0 ? (
                        <p className="text-center text-zinc-500 py-8">선택된 특허가 없습니다.</p>
                    ) : (
                        <>
                            <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                                {cart.map((r, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors">
                                        <div className="flex-1 space-y-1">
                                            <div className="font-mono text-sm text-zinc-600">{r.application_number}</div>
                                            <div className="text-sm font-medium truncate">{r.title}</div>
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="text-blue-600 font-medium">{r.collection_name}</span>
                                                {r.cpc_code && <span className="text-zinc-500">({r.cpc_code})</span>}
                                                {r.score && <span className="font-mono text-blue-600">점수: {r.score.toFixed(3)}</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(r.application_number)}
                                            className="ml-4 text-red-500 hover:text-red-700 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                                <button
                                    onClick={clearCart}
                                    className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 font-medium transition-all flex items-center gap-2"
                                >
                                    <Trash2 size={18} />
                                    전체 삭제
                                </button>
                                <button
                                    onClick={saveCart}
                                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2"
                                >
                                    <Save size={18} />
                                    등록하기
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}