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
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [project, setProject] = useState<Project | null>(null);
    const [collections, setCollections] = useState<Collections | null>(null);
    const [inputValue, setInputValue] = useState("");
    const [inputLocked, setInputLocked] = useState(false);

    const [loading, setLoading] = useState(true);
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
    const [perPage, setPerPage] = useState(10);
    const [totalPages, setTotalPages] = useState(0);
    
    const [openRow, setOpenRow] = useState<number | null>(null);

    const pagedResults = results; // API에서 이미 페이지네이션된 결과를 받음

    const taskMapper: Record<string, string> = {
        "classification": "이진분류",
        "multi-label": "다중분류",
        "regression": "회귀",
        "etc": "기타"
    };

    useEffect(() => {
        if (!project_id) return;
        if (!token) return;
        async function loadProject() {
            try {
                const resProject = await fetch(`${API_BASE}/api/project/${project_id}`);
                const dataProject = await resProject.json();
                setProject(dataProject);

                const resColections = await fetch(`${API_BASE}/api/collection/project/${project_id}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include"
                });
                const dataCollections = await resColections.json();
                
                setCollections(dataCollections)

            } catch (e) {
                alert("프로젝트 정보를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        loadProject();
    }, [project_id, token]);

    // CPC 그룹화
    const cpcGroups = useMemo(() => {
        const map: Record<string, any[]> = {};
        results.forEach((r) => {
            const key = r.cpc_code || "기타";
            if (!map[key]) map[key] = [];
            map[key].push(r);
        });
        return map;
    }, [results]);

    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

    async function doSearch(pageNum: number = 1) {
        if (pageNum === 1) {
            setSelected([]);
            setSelectedGroups([]);
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

            // ✅ data와 hits를 병합 (벡터 포함)
            const dataArray = data.data || [];
            const hitsArray = data.hits || [];
            
            // 검색어의 첫 20자를 collection_name으로 사용
            const autoCollectionName = keywords.trim().substring(0, 20);
            
            const newResults = dataArray.map((item: any, index: number) => {
                const hit = hitsArray[index] || {};
                return {
                    ...item,
                    vector: hit.vector || null, // hits에서 벡터 가져오기
                    score: hit.score || item.score,
                    collection_name: autoCollectionName, // 자동으로 collection_name 설정
                };
            });

            // 카트에 이미 있는 항목 제외
            const filteredResults = newResults.filter((r: any) => !cart.some((c) => c.application_number === r.application_number));
            setResults(filteredResults);
            
            // 검색 성공 시 inputValue도 업데이트 (기존 컬렉션 선택이 아닌 경우)
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
        
        // ✅ collection_name 통계 계산
        const collectionStats = new Map<string, number>();
        newItems.forEach((item) => {
            const name = item.collection_name || "(미지정)";
            collectionStats.set(name, (collectionStats.get(name) || 0) + 1);
        });
        
        // ✅ 알림 메시지 생성
        const collectionCount = collectionStats.size;
        const collectionDetails = Array.from(collectionStats.entries())
            .map(([name, count]) => `  • ${name}: ${count}개`)
            .join('\n');
        
        const message = `총 ${collectionCount}개의 컬렉션으로 ${newItems.length}개 항목을 담습니다.\n\n${collectionDetails}\n\n계속하시겠습니까?`;
        
        if (!confirm(message)) return;
        
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
            
            const res = await fetch(`${API_BASE}/api/project/${project_id}/save`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json", 
                    Authorization: `Bearer ${token}` 
                },
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
                    vector: cart.map((r) => r.vector || null),
                    n_application_number: notSelected.map((r) => r.application_number),
                    n_title: notSelected.map((r) => r.title),
                    n_abstract: notSelected.map((r) => r.abstract),
                    n_collection_name: notSelected.map((r) => r.collection_name),
                    n_vector: notSelected.map((r) => r.vector || null),
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
    console.log("?:", results)
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
                            <div className="grid gap-4 md:grid-cols-5">
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
                                    onKeyPress={(e) => e.key === 'Enter' && doSearch(1)}
                                    placeholder="키워드 입력"
                                    className="px-4 py-3 border-2 border-zinc-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                />
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
                                <button
                                    onClick={() => doSearch(1)}
                                    disabled={searching}
                                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center justify-center gap-2"
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
                                        const val = e.target.value;
                                        setSection(val);

                                        if (val !== "__new__") {
                                            const selectedName =
                                                collections?.collection_names[
                                                collections?.collection_codes.indexOf(val)
                                                ] || "";
                                            setResults((prev) =>
                                                prev.map((r) => ({
                                                    ...r,
                                                    collection_name: selectedName,
                                                }))
                                            );
                                            setInputValue(selectedName);
                                            setInputLocked(true);
                                        } else {
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
                                            {name}
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
                                    className={`px-3 py-2 border border-zinc-300 rounded-lg text-sm flex-1 ${
                                        inputLocked ? "bg-zinc-100 text-zinc-500" : "bg-white"
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
                                                    checked={pagedResults.length > 0 && pagedResults.every((r) => selected.includes(r.application_number))} 
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
                                                className={`px-3 py-2 border-2 rounded-lg transition-all ${
                                                    page === pageNum 
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
                                            선택 항목 등록
                                        </button>
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