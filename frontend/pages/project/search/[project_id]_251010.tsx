/* File: /home/yckim/development/ipforce_next/frontend/pages/project/new/search/[project_id].tsx */
import { useRouter } from "next/router";
import Head from "next/head";
import React, { use, useEffect, useState } from "react";
import Stepper from "@/components/layouts/ProjectStepper";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { ChevronsLeftRightEllipsis } from "lucide-react";

type Project = {
    id: number;
    project_code: string;
    project_name: string;
    project_description?: string;
    source_type: string;
    task_type: string;
    created_datetime?: string;
};

export default function ProjectSearchPage() {
    const router = useRouter();
    const { project_id } = router.query;

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // 검색 관련 state
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
    const pagedResults = results.slice((page - 1) * perPage, page * perPage);

    const [openRow, setOpenRow] = useState<number | null>(null);
    const stepItems = ["기본정보", "데이터 소스", "매칭/미리보기", "라벨/클래스", "학습 설정"];

    // 프로젝트 정보 로딩
    useEffect(() => {
        if (!project_id) return;
        async function loadProject() {
            try {
                const res = await fetch(`${API_BASE}/api/project/${project_id}`);
                const data = await res.json();
                setProject(data);
            } catch (e) {
                alert("프로젝트 정보를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        loadProject();
    }, [project_id]);

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
            if (!res.ok) {
                const err = await res.json();
                console.error("검색 실패:", err);
                throw new Error("검색 실패");
            }
            const data = await res.json();
            const newResults = data.items || [];
            setResults(
                newResults.filter(
                    (r: any) => !cart.some((c) => c.application_number === r.application_number)
                )
            );
            setTotal(data.total || 0);

        } catch (e: any) {
            alert(e.message || "검색 실패");
        } finally {
            setSearching(false);
        }
    }

    // const totalPages = Math.ceil(total / perPage);
    const totalPages = Math.ceil(results.length / perPage);
    const getPageNumbers = () => {
        const delta = 2; // 현재 페이지 기준 앞뒤 몇 개 보여줄지
        const pages: (number | string)[] = [];

        if (totalPages <= 7) {
            // 전체 페이지가 적으면 전부 표시
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const left = Math.max(2, page - delta);
        const right = Math.min(totalPages - 1, page + delta);

        pages.push(1);
        if (left > 2) pages.push("...");

        for (let i = left; i <= right; i++) {
            pages.push(i);
        }

        if (right < totalPages - 1) pages.push("...");
        pages.push(totalPages);

        return pages;
    };

    function toggleSelect(appNum: string) {
        setSelected((prev) =>
            prev.includes(appNum)
                ? prev.filter((n) => n !== appNum)
                : [...prev, appNum]
        );
    }

    function toggleSelectPage(checked: boolean) {
        if (checked) {
            // 현재 페이지 결과 전부 선택
            setSelected((prev) => {
                const pageAppNums = pagedResults.map((r) => r.application_number);
                const newSet = new Set([...prev, ...pageAppNums]);
                return Array.from(newSet);
            });
        } else {
            // 현재 페이지 결과 해제
            setSelected((prev) =>
                prev.filter((n) => !pagedResults.some((r) => r.application_number === n))
            );
        }
    }

    function toggleSelectAll(checked: boolean) {
        if (checked) {
            // 검색된 전체 결과 선택
            setSelected(results.map((r) => r.application_number));
        } else {
            // 전부 해제
            setSelected([]);
        }
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
            // return [...prev, ...remaining.filter((r) => !existing.has(r.application_number))];
            const filteredPrev = prev.filter(
                (r) => !newItems.some((ni) => ni.application_number === r.application_number)
            );
            const merged = [...filteredPrev, ...remaining.filter((r) => !existing.has(r.application_number))];
            return merged;

        });

        setSelected([]); // 선택 초기화
    }

    function removeFromCart(appNum: string) {
        const item = cart.find((r) => r.application_number === appNum);
        if (item) {
            // cart 에서 제거
            setCart((prev) =>
                prev.filter((r) => r.application_number !== appNum)
            );

            // results 로 복구
            // setResults((prev) => [item, ...prev]);
            setResults((prev) => {
                // 이미 존재하는 경우 제거
                const withoutDup = prev.filter((r) => r.application_number !== appNum);
                // 새 항목 추가 (맨 앞에 넣음)
                return [item, ...withoutDup];
            });

            // notSelected에도 다시 추가 (중복 방지)
            setNotSelected((prev) => {
                const exists = prev.some(
                    (r) => r.application_number === appNum
                );
                if (exists) return prev; // 이미 있으면 그대로
                return [item, ...prev]; // 새 항목 앞에 추가
            });
        }
    }

    function clearCart() {
        setResults((prev) => {
            // 중복 제거: cart 안에 있는 application_number 기준
            const cartAppNums = new Set(cart.map((r) => r.application_number));
            const withoutDup = prev.filter((r) => !cartAppNums.has(r.application_number));
            // cart에 있던 항목 전부 results로 복구 (맨 앞에 추가)
            return [...cart, ...withoutDup];
        });
        setCart([]);
    }

    async function saveCart() {
        try {
            if (!confirm("선택한 항목을 등록하시겠습니까?")) {
                return;
            }
            const res = await fetch(`${API_BASE}/api/project/${project_id}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    // if (loading) return <p className="p-6">불러오는 중...</p>;
    if (loading) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
                <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
            </div>
        );
    }

    const taskMapper: Record<string, string> = {
        "classification": "이진분류",
        "multi-label": "다중분류",
        "regression": "회귀",
        "etc": "기타"
    };

    return (
        <ProjectLayout step={2}>
            <Head>
                <title>프로젝트 #{project_id} | DB 검색 | IPFORCE</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
                <div className="mx-auto w-full max-w-3xl">
                    {/* <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                        프로젝트 생성
                    </h1>
                    <p className="mt-2 text-sm md:text-base text-zinc-500">
                        DB 검색 기반으로 프로젝트를 만듭니다.
                    </p>
                    <div className="mb-5">
                        <Stepper step={2} items={stepItems} />
                    </div> */}
                    <div className="mx-auto max-w-5xl space-y-6">
                        {/* 프로젝트 정보 */}
                        {project && (
                            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                                <h1 className="text-xl font-semibold text-zinc-900">{project.project_name}</h1>
                                <p className="mt-1 text-sm text-zinc-600">{project.project_description || "-"}</p>
                                <div className="mt-2 text-xs text-zinc-500">
                                    {taskMapper[project.task_type]} · {" "}
                                    {project.created_datetime
                                        ? new Date(project.created_datetime).toLocaleString()
                                        : "-"}
                                </div>
                            </div>
                        )}

                        {/* 특허 검색 영역 */}
                        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                            <h2 className="mb-4 text-lg font-medium text-zinc-900">특허 검색</h2>
                            <div className="grid gap-4 md:grid-cols-4">
                                <select
                                    className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                                    value={section}
                                    onChange={(e) => setSection(e.target.value)}
                                >
                                    <option value="">카테고리 선택</option>
                                    <option value="a">A (생활필수품)</option>
                                    <option value="b">B (작업, 운수)</option>
                                    <option value="c">C (화학, 야금)</option>
                                    <option value="d">D (섬유, 종이)</option>
                                    <option value="e">E (건설)</option>
                                    <option value="f">F (기계공학, 조명, 가열, 무기, 폭파)</option>
                                    <option value="g">G (물리학)</option>
                                    <option value="h">H (전기)</option>
                                    <option value="y">Y (신기술, 융합기술)</option>
                                </select>
                                <input
                                    className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                                    placeholder="키워드 입력 (예: EUV, 노광, 포토레지스트)"
                                    value={keywords}
                                    onChange={(e) => setKeywords(e.target.value)}
                                />
                                <input
                                    type="number"
                                    className="rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                                    value={limit}
                                    onChange={(e) => setLimit(parseInt(e.target.value || "0"))}
                                    placeholder="최대 개수"
                                />
                                <button
                                    onClick={doSearch}
                                    disabled={searching}
                                    className="rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                                >
                                    {searching ? "검색 중..." : "검색"}
                                </button>
                            </div>

                            {/* 검색 결과 테이블 상단 버튼 라인 */}
                            <div className="flex justify-between items-center mb-2 mt-5">
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelected(results.map((r) => r.application_number))}
                                        className="rounded-lg bg-blue-600 text-white px-3 py-1 text-sm hover:bg-blue-700"
                                    >
                                        전체 선택 ({results.length})
                                    </button>
                                    <button
                                        onClick={() => setSelected([])}
                                        className="rounded-lg bg-gray-200 text-gray-800 px-3 py-1 text-sm hover:bg-gray-300"
                                    >
                                        전체 해제
                                    </button>
                                </div>
                                <button
                                    onClick={addToCart}
                                    disabled={selected.length === 0}
                                    className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    담기 ({selected.length})
                                </button>
                            </div>

                            {/* 검색 결과 테이블 */}
                            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200">
                                <table className="w-full border-collapse text-sm">
                                    <thead className="bg-zinc-50 text-zinc-600">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        pagedResults.length > 0 &&
                                                        pagedResults.every((r) => selected.includes(r.application_number))
                                                    }
                                                    onChange={(e) => toggleSelectAll(e.target.checked)}
                                                />
                                            </th>
                                            <th className="px-3 py-2 text-left font-medium">#</th>
                                            <th className="px-3 py-2 text-left font-medium">출원번호</th>
                                            <th className="px-3 py-2 text-left font-medium">특허명</th>
                                            <th className="px-3 py-2 text-left font-medium">라벨</th>
                                            <th className="px-3 py-2 text-left font-medium"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {searching ? (
                                            <tr>
                                                <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                                                    검색 중...
                                                </td>
                                            </tr>
                                        ) : results.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan={4}
                                                    className="px-3 py-8 text-center text-zinc-500"
                                                >
                                                    검색 결과가 없습니다.
                                                </td>
                                            </tr>
                                        ) : (
                                            pagedResults.map((r, i) => (
                                                <React.Fragment key={r.id || i}>
                                                    <tr className="border-t border-zinc-200 hover:bg-zinc-50">
                                                        <td className="w-[5%] px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selected.includes(r.application_number)}
                                                                onChange={() => toggleSelect(r.application_number)}
                                                            />
                                                        </td>
                                                        <td className="w-[5%] px-3 py-2">{(page - 1) * perPage + i + 1}</td>
                                                        <td className="w-[20%] px-3 py-2 font-mono text-[13px]">
                                                            {r.application_number_norm || r.application_number}
                                                        </td>
                                                        <td className="w-[45%] px-3 py-2">{r.title}</td>
                                                        <td className="w-[15%] px-3 py-2">
                                                            {/* {r.collection_name || "-"} */}
                                                            <input
                                                                type="text"
                                                                value={r.collection_name || ""}
                                                                onChange={(e) => {
                                                                    const newCollectionName = e.target.value;
                                                                    setResults((prev) =>
                                                                        prev.map((item) =>
                                                                            item.application_number === r.application_number
                                                                                ? { ...item, collection_name: newCollectionName }
                                                                                : item
                                                                        )
                                                                    );
                                                                }}
                                                                className="w-full rounded-md border border-zinc-300 px-2 py-1 text-sm"
                                                                placeholder="라벨 입력"
                                                            />
                                                        </td>
                                                        <td className="w-[10%] px-3 py-2" onClick={() => setOpenRow(openRow === i ? null : i)}>
                                                            <button>{openRow === i ? '닫기' : '보기'}</button>
                                                        </td>
                                                    </tr>
                                                    {openRow === i && (
                                                        <tr className="bg-zinc-50">
                                                            <td colSpan={6} className="px-3 py-3 text-sm text-zinc-600">
                                                                {r.abstract || "요약이 없습니다."}
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* 페이지네이션 */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex justify-center gap-2 flex-wrap">
                                    {/* 맨앞 이동 */}
                                    <button
                                        onClick={() => setPage(1)}
                                        disabled={page === 1}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        «
                                    </button>

                                    {/* 이전 */}
                                    {/* <button
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        이전
                                    </button> */}
                                    <button
                                        onClick={() => setPage(page - 1)}
                                        disabled={page === 1}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        이전
                                    </button>

                                    {/* {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .slice(Math.max(0, page - 3), page + 2) // 현재 페이지 주변만
                                        .map((num) => (
                                        <button
                                            key={num}
                                            onClick={() => {
                                            setPage(num);
                                            doSearch();
                                            }}
                                            className={`px-3 py-1 rounded border text-sm ${
                                            num === page ? "bg-blue-600 text-white border-blue-600" : "bg-white text-zinc-700"
                                            }`}
                                        >
                                            {num}
                                        </button>
                                        ))} */}
                                    {/* 페이지 번호 */}
                                    {getPageNumbers().map((num, idx) =>
                                        typeof num === "string" ? (
                                            <span key={`ellipsis-${idx}`} className="px-3 py-1 text-sm text-zinc-500">
                                                {num}
                                            </span>
                                        ) : (
                                            <button
                                                key={`page-${num}-${idx}`}
                                                onClick={() => setPage(num)}
                                                className={`px-3 py-1 rounded border text-sm ${num === page
                                                        ? "bg-blue-600 text-white border-blue-600"
                                                        : "bg-white text-zinc-700"
                                                    }`}
                                            >
                                                {num}
                                            </button>
                                        )
                                    )}

                                    {/* 다음 */}
                                    {/* <button
                                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        다음
                                    </button> */}
                                    <button
                                        onClick={() => setPage(page + 1)}
                                        disabled={page === totalPages}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        다음
                                    </button>

                                    {/* 맨뒤 이동 */}
                                    <button
                                        onClick={() => setPage(totalPages)}
                                        disabled={page === totalPages}
                                        className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                                    >
                                        »
                                    </button>
                                </div>
                            )}

                            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
                                <h3 className="text-md font-medium text-zinc-900">
                                    장바구니 ({cart.length}개 선택됨)
                                </h3>

                                {cart.length === 0 ? (
                                    <p className="text-sm text-zinc-500 mt-2">선택된 특허가 없습니다.</p>
                                ) : (
                                    <ul className="mt-2 space-y-1 text-sm text-zinc-700 max-h-40 overflow-y-auto">
                                        {cart.map((r, i) => (
                                            <li key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] items-center gap-2">
                                                <span className="font-mono text-[13px] truncate">{r.application_number}</span>
                                                <span className="font-mono text-[13px] truncate">{r.title}</span>
                                                <span className="font-mono text-[13px] truncate">{r.collection_name}</span>
                                                <button
                                                    onClick={() =>
                                                        // setCart((prev) =>
                                                        //     prev.filter((x) => x.application_number !== r.application_number)
                                                        // )
                                                        removeFromCart(r.application_number)
                                                    }
                                                    className="text-red-500 hover:text-red-700 text-xs"
                                                >
                                                    삭제
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {cart.length > 0 && (
                                    <div className="flex justify-end gap-2 mt-3">
                                        <button
                                            onClick={clearCart}
                                            className="rounded-lg bg-gray-200 text-gray-800 px-3 py-1 text-sm hover:bg-gray-300"
                                        >
                                            전체 삭제 (복구)
                                        </button>
                                        <button
                                            onClick={saveCart}
                                            className="rounded-lg bg-green-600 text-white px-4 py-2 text-sm hover:bg-green-700"
                                        >
                                            선택 항목 등록
                                        </button>

                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </ProjectLayout>
    );
}
