/* File: pages/project/index.tsx */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Database, UploadCloud, Search } from "lucide-react";

type Project = {
  id: number;
  project_name: string;
  project_description?: string;
  project_status: number;
  source_type: "search" | "upload";
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "이진분류",
  "multi-label": "다중분류",
  regression: "회귀",
  etc: "기타",
};

export default function ProjectListPage() {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);

    // 검색 & 페이지네이션 상태
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(6); // 페이지당 표시 개수
    const [total, setTotal] = useState(0);
    const urlMap = (id: number, status: number): string => {
        switch (status) {
        case 0:
        case 1:
            return `/project/search/${id}`;
        case 2:
            return `/project/preview/${id}`;
        case 3:
            return `/project/labels/${id}`;
        case 4:
            return `/project/train/${id}`;
        default:
            return `/project/search/${id}`; // 
        }
    };
        
    useEffect(() => {
        async function loadProjects() {
        try {
            setLoading(true);
            const res = await fetch(
                `${API_BASE}/api/ai?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
                    credentials: "include", // 쿠키 자동 포함
            });
            const data = await res.json();
            console.log(data)
            setProjects(data.items || []);
            setTotal(data.total || 0);
        } catch (e) {
            alert("인공지능 목록을 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
        }

        const debounce = setTimeout(loadProjects, 300); // 디바운스
        return () => clearTimeout(debounce);
    }, [query, page, limit]);

    const totalPages = Math.ceil(total / limit);

    // 페이지네이션 버튼 생성 (현재 페이지 주변 2개까지만 표시)
    const getPageNumbers = () => {
        const pages: number[] = [];
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);

        for (let i = start; i <= end; i++) {
        pages.push(i);
        }
        return pages;
    };

    return (
        <>
        <Head>
            <title>인공지능 관리 | IPFORCE</title>
            <meta name="robots" content="noindex" />
        </Head>

        <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
            <div className="mx-auto max-w-5xl">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                인공지능 관리
            </h1>
            <p className="mt-2 text-sm md:text-base text-zinc-500">
                등록된 인공지능 목록입니다.
            </p>

            {/* 검색창 */}
            <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                type="text"
                placeholder="프로젝트 검색..."
                value={query}
                onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1); // 검색 시 첫 페이지로 초기화
                }}
                className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
            </div>

            {loading ? (
                <div className="flex min-h-[200px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
                <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
                </div>
            ) : projects.length === 0 ? (
                <p className="mt-6 text-sm text-zinc-500">검색 결과가 없습니다.</p>
            ) : (
                <>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {projects.map((p) => (
                    <Link
                        key={p.id}
                        // href={`/project/${p.source_type}/${p.id}`}
                        href={urlMap(p.id, p.project_status)}
                        className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                    >
                        <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                            {p.source_type === "search" ? (
                            <Database className="h-6 w-6 text-zinc-700" />
                            ) : (
                            <UploadCloud className="h-6 w-6 text-zinc-700" />
                            )}
                        </div>
                        <div>
                            <h2 className="text-lg font-medium text-zinc-900">
                            {p.project_name}
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500">
                            {p.project_description || "설명 없음"}
                            </p>
                            <p className="mt-1 text-xs text-zinc-400">
                            {taskMapper[p.task_type] ?? p.task_type} ·{" "}
                            {p.created_datetime
                                ? new Date(p.created_datetime).toLocaleDateString()
                                : "-"}
                            </p>
                        </div>
                        </div>
                    </Link>
                    ))}
                </div>

                {/* 📄 숫자 페이지네이션 */}
                <div className="mt-6 flex justify-center gap-2">
                    <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    >
                    이전
                    </button>

                    {getPageNumbers().map((num) => (
                    <button
                        key={num}
                        onClick={() => setPage(num)}
                        className={`px-3 py-1 rounded border text-sm ${
                        num === page
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-zinc-700"
                        }`}
                    >
                        {num}
                    </button>
                    ))}

                    <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded border text-sm disabled:opacity-50"
                    >
                    다음
                    </button>
                </div>
                </>
            )}
            </div>
        </main>
        </>
    );
}
