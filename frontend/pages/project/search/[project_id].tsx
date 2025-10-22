import { useRouter } from "next/router";
import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { Search, ShoppingCart, Trash2, Save, Loader2, ChevronDown, ChevronUp, Package } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

type Project = {
    id: number;
    project_code: string;
    project_name: string;
    project_description?: string;
    source_type: string;
    task_type: string;
    created_datetime?: string;
};

type Collections = {
    collection_ids: number[];
    collection_codes: string[];
    collection_names: string[];
}

export default function ProjectSearchPage() {
    const router = useRouter();
    const { project_id } = router.query;
    const API_BASE = "http://192.168.1.20:8000";

    const [project, setProject] = useState<Project | null>(null);
    const [collections, setCollections] = useState<Collections | null>(null);
    const [inputValue, setInputValue] = useState("");       // 입력창의 현재 값
    const [inputLocked, setInputLocked] = useState(false);  // 입력창 잠금 여부

    const [loading, setLoading] = useState(true);
    const [section, setSection] = useState("");
    const [keywords, setKeywords] = useState("");
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<any[]>([]);
    const [selected, setSelected] = useState<any[]>([]);
    const [notSelected, setNotSelected] = useState<any[]>([]);
    const [cart, setCart] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [limit, setLimit] = useState(500);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);
    const [openRow, setOpenRow] = useState<number | null>(null);

    const pagedResults = results.slice((page - 1) * perPage, page * perPage);

    const groupCounts = useMemo(() => {
        const acc: Record<string, number> = {};
        for (const r of results) {
            const key = (r.collection_name ?? "").trim() || "(미분류)";
            acc[key] = (acc[key] ?? 0) + 1;
        }
        return acc;
    }, [results]);

    const groups = useMemo(() => Object.keys(groupCounts).sort(), [groupCounts]);
    const [selectedGroup, setSelectedGroup] = useState<string>("");

    const taskMapper: Record<string, string> = {
        "classification": "이진분류",
        "multi-label": "다중분류",
        "regression": "회귀",
        "etc": "기타"
    };

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    useEffect(() => {
        if (!project_id) return;
        async function loadProject() {
            try {
                const resProject = await fetch(`${API_BASE}/api/project/${project_id}`);
                const dataProject = await resProject.json();
                setProject(dataProject);

                const resColections = await fetch(`${API_BASE}/api/collection/project/${project_id}`, { credentials: "include" });
                const dataCollections = await resColections.json();
                console.log(dataCollections)
                setCollections(dataCollections)

            } catch (e) {
                alert("프로젝트 정보를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        loadProject();
    }, [project_id]);


    // ------------------------------------------------------------------------------------------
    // ✅ CPC 그룹화 (검색 결과를 기준으로)
    const cpcGroups = useMemo(() => {
        const map: Record<string, any[]> = {};
        results.forEach((r) => {
            const key = r.cpc_code || "기타";
            if (!map[key]) map[key] = [];
            map[key].push(r);
        });
        return map;
    }, [results]);

    // ✅ 그룹별 선택 상태 관리
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    // ✅ 그룹 선택/해제 함수
    function toggleGroupSelect(code: string) {
        const isSelected = selectedGroups.includes(code);
        const newSelectedGroups = isSelected
            ? selectedGroups.filter((c) => c !== code)
            : [...selectedGroups, code];
        setSelectedGroups(newSelectedGroups);

        // 그룹 내 모든 출원번호 가져오기
        const groupAppNums = (cpcGroups[code] || []).map((r) => r.application_number);

        // 전체 selected 업데이트
        setSelected((prev) => {
            const current = new Set(prev);
            if (isSelected) {
                // 해제
                groupAppNums.forEach((num) => current.delete(num));
            } else {
                // 선택
                groupAppNums.forEach((num) => current.add(num));
            }
            return Array.from(current);
        });
    }
    // ------------------------------------------------------------------------------------------

    async function doSearch() {
        setPage(1);
        setSelected([]);
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
            const res = await fetch(`${API_BASE}/api/project/${project_id}/search?section=${section}&limit=${limit}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ keywords: String(keywords) }),
            });
            if (!res.ok) throw new Error("검색 실패");
            const data = await res.json();
            const newResults = data.items || [];
            setResults(newResults.filter((r: any) => !cart.some((c) => c.application_number === r.application_number)));
            setTotal(data.total || 0);
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
        setNotSelected((prev) => {
            const existing = new Set(prev.map((x) => x.application_number));
            const filteredPrev = prev.filter((r) => !newItems.some((ni) => ni.application_number === r.application_number));
            return [...filteredPrev, ...remaining.filter((r) => !existing.has(r.application_number))];
        });
        setSelected([]);
        setPage(1);
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
            const res = await fetch(`${API_BASE}/api/project/${project_id}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({
                    source_type: project?.source_type,
                    project_code: project?.project_code,
                    project_name: project?.project_name,
                    project_desc: project?.project_description,
                    application_numbers: cart.map((r) => r.application_number),
                    title: cart.map((r) => r.title),
                    abstract: cart.map((r) => r.abstract),
                    collection_name: cart.map((r) => r.collection_name),
                    vector: cart.map((r) => r.vector),
                    n_application_number: notSelected.map((r) => r.application_number),
                    n_title: notSelected.map((r) => r.title),
                    n_abstract: notSelected.map((r) => r.abstract),
                    n_collection_name: notSelected.map((r) => r.collection_name),
                    n_vector: notSelected.map((r) => r.vector),
                }),
            });
            if (!res.ok) throw new Error("등록 실패");
            alert("등록 완료!");
            setCart([]);
            router.push(`/project/preview/${project_id}`);
        } catch (e: any) {
            alert(e.message || "등록 중 오류 발생");
        }
    }

    const totalPages = Math.ceil(results.length / perPage);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    <span className="text-zinc-600">불러오는 중...</span>
                </div>
            </div>
        );
    }

    return (
        <ProjectLayout step={2}>
            <Head>
                <title>프로젝트 #{project_id} | DB 검색 | IPFORCE</title>
            </Head>

            <div className="min-h-screen bg-white p-8">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Project Info Card */}
                    {project && (
                        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                                <h1 className="text-2xl font-bold text-white">{project.project_name}</h1>
                                <p className="text-blue-100 text-sm mt-1">{project.project_description || "-"}</p>
                            </div>
                            <div className="px-8 py-4 bg-zinc-50 border-b border-zinc-100 flex items-center gap-4 text-sm">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                    {taskMapper[project.task_type]}
                                </span>
                                <span className="text-zinc-500">
                                    {project.created_datetime ? new Date(project.created_datetime).toLocaleString() : "-"}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Search Section */}
                    <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                            <div className="flex items-center gap-3">
                                <Search className="w-6 h-6 text-white" />
                                <h2 className="text-xl font-semibold text-white">특허 검색</h2>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {/* Search Inputs */}
                            <div className="grid gap-4 md:grid-cols-4">
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
                                <input
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                    placeholder="키워드 입력"
                                    className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                />
                                <input
                                    type="number"
                                    value={limit}
                                    onChange={(e) => setLimit(parseInt(e.target.value || "0"))}
                                    placeholder="최대 개수"
                                    className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                />
                                <button
                                    onClick={doSearch}
                                    disabled={searching}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center justify-center gap-2"
                                >
                                    {searching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                    {searching ? "검색중..." : "검색"}
                                </button>
                            </div>

                            <div className="flex items-center gap-3 border border-zinc-200 p-4 rounded-xl bg-zinc-50">
                                <label className="text-sm font-medium text-zinc-700">콜렉션 명:</label>

                                {/* 🔹 기본값은 "__new__" (직접입력) */}
                                <select
                                    value={section || "__new__"}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setSection(val);

                                        if (val !== "__new__") {
                                            const selectedName =
                                                collections?.collection_names[
                                                collections?.collection_codes.indexOf(val)
                                                ] || "";
                                            // 기존 콜렉션 선택 시 전체 적용
                                            setResults((prev) =>
                                                prev.map((r) => ({
                                                    ...r,
                                                    collection_name: selectedName,
                                                }))
                                            );
                                            setInputValue(selectedName); // 입력창에도 표시
                                            setInputLocked(true); // 입력창 잠금
                                        } else {
                                            // 직접 입력으로 돌아갈 때
                                            setInputValue("");
                                            setInputLocked(false);
                                            setResults((prev) =>
                                                prev.map((r) => ({
                                                    ...r,
                                                    collection_name: "",
                                                }))
                                            );
                                        }
                                    }}
                                    className="px-3 py-2 border border-zinc-300 rounded-lg text-sm"
                                >
                                    <option value="__new__">+ 직접 입력</option>
                                    {collections?.collection_names?.map((name, idx) => (
                                        <option key={idx} value={collections.collection_codes[idx]}>
                                            {name} {/* ({collections.collection_codes[idx]}) */}
                                        </option>
                                    ))}
                                </select>

                                {/* 🔹 입력창 — 기본값 활성, 기존 선택 시 잠김 */}
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

                                <button
                                    onClick={() => {
                                        if (!inputValue.trim()) return alert("콜렉션 이름을 입력하세요.");
                                        alert(`현재 검색 결과에 "${inputValue}" 콜렉션이 적용되었습니다.`);
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-all"
                                >
                                    적용
                                </button>
                            </div>

                            {/* ✅ CPC 그룹별 선택 섹션 */}
                            {results.length > 0 && (
                                <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-3">
                                    <h3 className="text-sm font-semibold text-blue-900">
                                        CPC 코드별 그룹 선택
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                        {Object.entries(cpcGroups).map(([code, items]) => {
                                            const isSelected = selectedGroups.includes(code);
                                            return (
                                                <button
                                                    key={code}
                                                    onClick={() => toggleGroupSelect(code)}
                                                    className={`px-3 py-2 text-sm rounded-lg border transition-all font-medium ${isSelected
                                                        ? "bg-blue-600 text-white border-blue-600"
                                                        : "bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                                                        }`}
                                                >
                                                    {code} <span className="text-xs opacity-80">({items.length})</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {selectedGroups.length > 0 && (
                                        <div className="text-xs text-blue-800 mt-2">
                                            선택된 그룹: {selectedGroups.join(", ")} (
                                            {selected.length.toLocaleString()}건 선택됨)
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex justify-between items-center">
                                <div className="flex gap-2 flex-wrap">
                                    <button onClick={() => toggleSelectAll(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-all">
                                        전체 선택 ({results.length})
                                    </button>
                                    <button onClick={() => toggleSelectAll(false)} className="px-4 py-2 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 text-sm font-medium transition-all">
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
                                            <th className="px-4 py-3 text-left"><input type="checkbox" checked={pagedResults.length > 0 && pagedResults.every((r) => selected.includes(r.application_number))} onChange={(e) => toggleSelectAll(e.target.checked)} className="w-4 h-4" /></th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">#</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">출원번호</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">특허명</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">라벨</th>
                                            <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {searching ? (
                                            <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">검색 중...</td></tr>
                                        ) : results.length === 0 ? (
                                            <tr><td colSpan={6} className="px-4 py-12 text-center text-zinc-500">검색 결과가 없습니다.</td></tr>
                                        ) : (
                                            pagedResults.map((r, i) => (
                                                <React.Fragment key={r.id || i}>
                                                    <tr className="border-t border-zinc-200 hover:bg-blue-50 transition-colors">
                                                        <td className="px-4 py-3"><input type="checkbox" checked={selected.includes(r.application_number)} onChange={() => toggleSelect(r.application_number)} className="w-4 h-4" /></td>
                                                        <td className="px-4 py-3 text-sm">{(page - 1) * perPage + i + 1}</td>
                                                        <td className="px-4 py-3 text-sm font-mono">{r.application_number_norm || r.application_number}</td>
                                                        <td className="px-4 py-3 text-sm">{r.title}</td>
                                                        <td className="px-4 py-3"><input type="text" value={r.collection_name || ""} onChange={(e) => setResults((prev) => prev.map((item) => item.application_number === r.application_number ? { ...item, collection_name: e.target.value } : item))} className="w-full px-2 py-1 border border-zinc-300 rounded-lg text-sm" placeholder="라벨 입력" /></td>
                                                        <td className="px-4 py-3"><button onClick={() => setOpenRow(openRow === i ? null : i)} className="text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm font-medium">{openRow === i ? <><ChevronUp size={16} />닫기</> : <><ChevronDown size={16} />보기</>}</button></td>
                                                    </tr>
                                                    {openRow === i && (<tr className="bg-blue-50"><td colSpan={6} className="px-4 py-4 text-sm text-zinc-600 leading-relaxed">{r.abstract || "요약이 없습니다."}</td></tr>)}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2">
                                    <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all">«</button>
                                    <button onClick={() => setPage(page - 1)} disabled={page === 1} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all">이전</button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pageNum = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                                        return pageNum <= totalPages ? (
                                            <button key={pageNum} onClick={() => setPage(pageNum)} className={`px-3 py-2 border-2 rounded-lg transition-all ${page === pageNum ? 'bg-blue-600 text-white border-blue-600' : 'border-zinc-200 hover:bg-zinc-50'}`}>{pageNum}</button>
                                        ) : null;
                                    })}
                                    <button onClick={() => setPage(page + 1)} disabled={page === totalPages} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all">다음</button>
                                    <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-zinc-50 transition-all">»</button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Section */}
                    <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Package className="w-6 h-6 text-white" />
                                    <h3 className="text-xl font-semibold text-white">선택한 특허</h3>
                                </div>
                                <span className="px-4 py-2 bg-white/20 rounded-full text-white font-bold">{cart.length}개</span>
                            </div>
                        </div>
                        <div className="p-8">
                            {cart.length === 0 ? (
                                <p className="text-center text-zinc-500 py-8">선택된 특허가 없습니다.</p>
                            ) : (
                                <>
                                    <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                                        {cart.map((r, i) => (
                                            <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg hover:bg-zinc-100 transition-colors">
                                                <div className="flex-1 grid grid-cols-3 gap-4 text-sm">
                                                    <span className="font-mono truncate">{r.application_number}</span>
                                                    <span className="truncate">{r.title}</span>
                                                    <span className="truncate text-blue-600 font-medium">{r.collection_name}({r.cpc_code})</span>
                                                </div>
                                                <button onClick={() => removeFromCart(r.application_number)} className="ml-4 text-red-500 hover:text-red-700 transition-colors"><Trash2 size={18} /></button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                                        <button onClick={clearCart} className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-300 font-medium transition-all flex items-center gap-2"><Trash2 size={18} />전체 삭제</button>
                                        <button onClick={saveCart} className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all flex items-center gap-2"><Save size={18} />선택 항목 등록</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ProjectLayout>
    );
}