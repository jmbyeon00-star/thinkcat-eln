import Head from "next/head";
import React, { useState } from "react";
import { Search, ShoppingCart, Trash2, Save, Loader2, ChevronDown, ChevronUp, Package, Settings } from "lucide-react";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export default function TestSearchPage() {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const [apiUrl, setApiUrl] = useState(`${API_BASE}/api/search/keyword`);
    const [section, setSection] = useState("");
    const [keywords, setKeywords] = useState("");
    const [searchMethod, setSearchMethod] = useState("bgem3");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [selected, setSelected] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [totalHits, setTotalHits] = useState(0);
    const [maxSize, setMaxSize] = useState(0);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    const [openRow, setOpenRow] = useState<number | null>(null);
    const [showSettings, setShowSettings] = useState(false);

    const pagedResults = results;

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
                `${apiUrl}?section=${section}&keyword=${encodeURIComponent(keywords)}&page=${pageNum}&page_size=${perPage}&method=${searchMethod}`
            );
            if (!res.ok) throw new Error("검색 실패");
            const data = await res.json();

            setResults(data.data || []);
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
        setCart((prev) => {
            const existing = new Set(prev.map((x) => x.application_number));
            return [...prev, ...newItems.filter((r) => !existing.has(r.application_number))];
        });
        const remaining = results.filter((r) => !selected.includes(r.application_number));
        setResults(remaining);
        setSelected([]);
    }

    function removeFromCart(appNum: string) {
        setCart((prev) => prev.filter((r) => r.application_number !== appNum));
    }

    function clearCart() {
        if (!confirm("카트를 전체 삭제하시겠습니까?")) return;
        setCart([]);
    }

    function saveCart() {
        alert(`${cart.length}개 항목을 저장했습니다. (실제 저장 기능은 구현 필요)`);
        console.log("Cart items:", cart);
    }

    return (
        <>
            <Head>
                <title>특허 검색 테스트</title>
            </Head>
            <div className="min-h-screen bg-gradient-to-br from-zinc-50 via-blue-50 to-indigo-50">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 mb-2">
                            특허 검색 테스트
                        </h1>
                        <p className="text-zinc-600">페이지네이션 기반 특허 검색 시스템</p>
                    </div>

                    {/* Settings Panel */}
                    {showSettings && (
                        <div className="mb-6 bg-amber-50 rounded-xl p-6 border-2 border-amber-200">
                            <h3 className="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5" />
                                API 설정
                            </h3>
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                                className="w-full px-4 py-2 border-2 border-amber-300 rounded-lg font-mono text-sm"
                                placeholder=""
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Search Section */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                            <Search className="w-7 h-7" />
                                            특허 검색
                                        </h2>
                                        <button
                                            onClick={() => setShowSettings(!showSettings)}
                                            className="px-3 py-2 bg-white/20 rounded-lg hover:bg-white/30 transition-all"
                                        >
                                            <Settings className="w-5 h-5 text-white" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-8 space-y-6">
                                    {/* Search Inputs */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 mb-2">카테고리</label>
                                            <select
                                                value={section}
                                                onChange={(e) => setSection(e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                                            >
                                                <option value="">선택하세요</option>
                                                <option value="h">H - 전기</option>
                                                <option value="g">G - 물리</option>
                                                <option value="a">A - 생활필수품</option>
                                                <option value="b">B - 처리조작</option>
                                                <option value="c">C - 화학</option>
                                                <option value="d">D - 섬유</option>
                                                <option value="e">E - 고정구조물</option>
                                                <option value="f">F - 기계공학</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 mb-2">검색 방법</label>
                                            <select
                                                value={searchMethod}
                                                onChange={(e) => setSearchMethod(e.target.value)}
                                                className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                                            >
                                                <option value="bgem3">BGE-M3 (벡터 검색)</option>
                                                <option value="mlt">MLT (텍스트 유사도)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-zinc-700 mb-2">검색 키워드</label>
                                        <input
                                            type="text"
                                            value={keywords}
                                            onChange={(e) => setKeywords(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && doSearch(1)}
                                            className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                                            placeholder="검색 키워드를 입력하세요..."
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-zinc-700 mb-2">페이지당 결과 수</label>
                                            <select
                                                value={perPage}
                                                onChange={(e) => setPerPage(Number(e.target.value))}
                                                className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
                                            >
                                                <option value="10">10개씩</option>
                                                <option value="20">20개씩</option>
                                                <option value="50">50개씩</option>
                                                <option value="100">100개씩</option>
                                            </select>
                                        </div>
                                        <div className="flex items-end">
                                            <button
                                                onClick={() => doSearch(1)}
                                                disabled={searching}
                                                className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center justify-center gap-2"
                                            >
                                                {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                                {searching ? "검색중..." : "검색"}
                                            </button>
                                        </div>
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
                                                            checked={pagedResults.length > 0 && pagedResults.every((r) => selected.includes(r.application_number))}
                                                            onChange={(e) => toggleSelectAll(e.target.checked)}
                                                            className="w-4 h-4"
                                                        />
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">#</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">출원번호</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">특허명</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">점수</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {searching ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                                                            검색 중...
                                                        </td>
                                                    </tr>
                                                ) : results.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                                                            검색 결과가 없습니다.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    pagedResults.map((r, i) => (
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
                                                                    <td colSpan={6} className="px-4 py-4 text-sm text-zinc-600 leading-relaxed">
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
                        </div>

                        {/* Cart Section */}
                        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden h-fit">
                            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Package className="w-6 h-6 text-white" />
                                        <h3 className="text-xl font-semibold text-white">선택한 특허</h3>
                                    </div>
                                    <span className="px-4 py-2 bg-white/20 rounded-full text-white font-bold">
                                        {cart.length}개
                                    </span>
                                </div>
                            </div>
                            <div className="p-8">
                                {cart.length === 0 ? (
                                    <p className="text-center text-zinc-500 py-8">선택된 특허가 없습니다.</p>
                                ) : (
                                    <>
                                        <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
                                            {cart.map((r, i) => (
                                                <div
                                                    key={i}
                                                    className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors"
                                                >
                                                    <div className="flex-1 space-y-1">
                                                        <div className="font-mono text-sm text-zinc-600">{r.application_number}</div>
                                                        <div className="text-sm font-medium truncate">{r.title}</div>
                                                        <div className="text-xs text-blue-600 font-mono">
                                                            점수: {r.score?.toFixed(3)}
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
                                                저장
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}