import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleDashed, CircleCheckBig, Search, LayoutGrid, Table as TableIcon } from "lucide-react";
import ModelProgressSSE from "@/components/ModelProgressSSE";

type Project = {
  id: number;
  model_name: string;
  model_desc?: string;
  task_type: string;
  progress: number;
  progress_status: "RUNNING" | "COMPLETED" | "FAILED";
  data_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "이진분류",
  "multi-label": "다중분류",
  regression: "회귀",
  etc: "기타",
};

export default function ProjectListPage() {
//   const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const API_BASE = "http://192.168.1.20:8000"
  
  const [models, setModels] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // 검색 & 페이지네이션 상태
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  // 뷰 모드 상태 (grid | table)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    async function loadModels() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/ai?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
            credentials: "include",
          }
        );
        const data = await res.json();
        setModels(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        alert("인공지능 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(loadModels, 300);
    return () => clearTimeout(debounce);
  }, [query, page, limit]);

  const totalPages = Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
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
                <div className="flex items-center justify-between">
                    <div>
                    <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                        인공지능 관리
                    </h1>
                    <p className="mt-1 text-sm md:text-base text-zinc-500">
                        등록된 인공지능 목록입니다.
                    </p>
                    </div>
                    <button
                    onClick={() => setViewMode(viewMode === "grid" ? "table" : "grid")}
                    className="flex items-center gap-2 rounded border px-3 py-1 text-sm hover:bg-zinc-100"
                    >
                    {viewMode === "grid" ? (
                        <>
                        <TableIcon className="h-4 w-4" /> 테이블 보기
                        </>
                    ) : (
                        <>
                        <LayoutGrid className="h-4 w-4" /> 카드 보기
                        </>
                    )}
                    </button>
                </div>

                {/* 검색창 */}
                <div className="mt-4 relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                    <input
                    type="text"
                    placeholder="프로젝트 검색..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1);
                    }}
                    className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                </div>

                {loading ? (
                    <div className="flex min-h-[200px] items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
                    <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
                    </div>
                ) : models.length === 0 ? (
                    <p className="mt-6 text-sm text-zinc-500">검색 결과가 없습니다.</p>
                ) : (
                    <>
                    {viewMode === "grid" ? (
                        // 기존 카드 뷰
                        <div className="mt-6 grid gap-4 md:grid-cols-2">
                            {models.map((m) => (
                                <Link
                                key={m.id}
                                href={m.progress_status === "RUNNING" ? `/ai/training/${m.id}` : `/ai/${m.id}`}
                                className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                                        {m.progress_status === "RUNNING" ? (
                                            <CircleDashed className="h-6 w-6 text-zinc-700" />
                                        ) : (
                                            <CircleCheckBig className="h-6 w-6 text-zinc-700" />
                                        )}
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-medium text-zinc-900">
                                                {m.model_name}
                                            </h2>
                                            <p className="mt-1 text-sm text-zinc-500">
                                                {m.model_desc || "설명 없음"}
                                            </p>
                                            <p className="mt-1 text-xs text-zinc-400">
                                                {taskMapper[m.task_type] ?? m.task_type} ·{" "}
                                                {m.created_datetime
                                                ? new Date(m.created_datetime).toLocaleDateString()
                                                : "-"}
                                            </p>
                                        </div>
                                    </div>
                                    {m.progress_status === "RUNNING" ? (
                                        <ModelProgressSSE targetId={m.id} initialProgress={m.progress} />
                                    ) : m.progress_status === "FAILED" ? (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 mt-5">
                                        🔴 학습 실패 ({m.progress}%)
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 mt-5">
                                        ✅ 학습 완료
                                        </span>
                                    )}
                                </Link>
                            ))}
                        </div>
                    ) : (
                        // 테이블 뷰
                        <div className="mt-8 overflow-hidden rounded-xl border border-zinc-200 shadow-sm">
                            <table className="w-full border-collapse text-sm">
                                <thead>
                                <tr className="bg-zinc-50 text-zinc-600 text-left">
                                    <th className="px-6 py-3 font-semibold">ID</th>
                                    <th className="px-6 py-3 font-semibold">프로젝트명</th>
                                    <th className="px-6 py-3 font-semibold">설명</th>
                                    <th className="px-6 py-3 font-semibold">작업 유형</th>
                                    <th className="px-6 py-3 font-semibold">생성일</th>
                                    <th className="px-6 py-3 font-semibold text-center">이동</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-200 bg-white">
                                {models.map((m) => (
                                    <tr key={m.id} className="hover:bg-blue-50/40 transition">
                                    <td className="px-6 py-3 text-zinc-700">{m.id}</td>
                                    <td className="px-6 py-3 font-medium text-zinc-900">{m.model_name}</td>
                                    <td className="px-6 py-3 text-zinc-600">{m.model_desc || "설명 없음"}</td>
                                    {/* <td className="px-6 py-3 text-zinc-600">{taskMapper[m.task_type] ?? m.task_type}</td> */}
                                    <td className="px-6 py-3 text-zinc-600">
                                        {m.progress_status === "RUNNING" ? (
                                            <div className="relative w-40 bg-zinc-200 rounded-full h-4">
                                                <div
                                                    className={`h-4 rounded-full transition-all duration-500 ${
                                                        m.progress !== 100
                                                        ? "bg-blue-500"
                                                        : "bg-green-500"
                                                    }`}
                                                    style={{ width: `${m.progress}%` }}
                                                />
                                                <span
                                                    className={`absolute inset-0 text-xs flex items-center justify-center transition-colors duration-300 ${
                                                    m.progress < 50
                                                    ? "text-gray-500"
                                                    : m.progress < 80
                                                    ? "text-white"
                                                    : m.progress < 90
                                                    ? "text-orange-300"
                                                    : m.progress < 99
                                                    ? "text-red-300 font-bold"
                                                    : m.progress < 100
                                                    ? "text-red-500 font-bold"
                                                    : "text-white font-bold"
                                                }`}
                                                >
                                                    {m.progress}%
                                                </span>
                                        </div>
                                        ) : (
                                            <span className="font-medium">{m.progress}%</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-3 text-zinc-500">
                                        {m.created_datetime
                                        ? new Date(m.created_datetime).toLocaleDateString()
                                        : "-"}
                                    </td>
                                    <td className="px-6 py-3 text-center">
                                        {/* <Link
                                        href={urlMap(m.id, m.project_status)}
                                        className="inline-block rounded-lg border border-blue-600 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-600 hover:text-white transition"
                                        > */}
                                            이동
                                        {/* </Link> */}
                                    </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                            </div>
                    )}

                    {/* 페이지네이션 */}
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
