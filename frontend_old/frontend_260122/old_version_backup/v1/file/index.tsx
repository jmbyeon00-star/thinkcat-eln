"use client";

/* File: pages/file/index.tsx */
import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, Loader2, CheckCircle2, XCircle, Search, LayoutGrid, Table as TableIcon } from "lucide-react";
import ModelProgressSSE from "@/components/ModelProgressSSE";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import { useUserTaskStore } from "@/lib/store/useUserTaskStore";

type FileItem = {
  id: number;
  file_name: string;
  model_code: string;
  file_size: number;
  progress: number;
  progress_status: "RUNNING" | "COMPLETED" | "FAILED";
  created_datetime?: string;
};

export default function FileListPage() {
  const { status: storeStatus } = useUserTaskStore();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { data: session, status: sessionStatus } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");

  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    async function loadFiles() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/files?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setFiles(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        alert("파일 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(loadFiles, 300);
    return () => clearTimeout(debounce);
  }, [query, page, limit, storeStatus]);

  const totalPages = Math.ceil(total / limit);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const getStatusBadge = (status: string, progress: number) => {
    switch (status) {
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
            <Loader2 className="h-3 w-3 animate-spin" /> 진행중 ({progress}%)
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="h-3 w-3" /> 완료
          </span>
        );
      case "FAILED":
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
            <XCircle className="h-3 w-3" /> 실패
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
            대기중
          </span>
        );
    }
  };

  return (
    <>
      <Head>
        <title>파일 관리 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
        <div className="mx-auto max-w-5xl">
          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                파일 관리
              </h1>
              <p className="mt-2 text-sm md:text-base text-zinc-500">
                업로드된 파일의 추론 상태를 확인할 수 있습니다.
              </p>
            </div>

            {/* 뷰 전환 버튼 */}
            <button
              onClick={() =>
                setViewMode(viewMode === "grid" ? "table" : "grid")
              }
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

          {/* 검색 */}
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="파일명 또는 모델코드 검색..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-zinc-300 pl-9 pr-3 py-2 text-sm focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            />
          </div>

          {/* 로딩 / 결과 */}
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
              <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
            </div>
          ) : files.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">검색 결과가 없습니다.</p>
          ) : (
            <>
              {viewMode === "grid" ? (
                // 카드 뷰
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {files.map((f) => (
                    <Link
                      key={f.id}
                      href={status === "COMPLETED" || f.progress_status === "COMPLETED" ? `/file/${f.id}` : "#"}
                      // className={`block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition ${f.progress_status === "COMPLETED"
                      className={`block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition ${(status || f.progress_status) === "COMPLETED"
                        ? "hover:shadow-md"
                        : "opacity-75 cursor-not-allowed"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                          <FileText className="h-6 w-6 text-zinc-700" />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg font-medium text-zinc-900 truncate">
                            {f.file_name}
                          </h2>
                          <p className="mt-1 text-sm text-zinc-500 truncate">
                            모델 코드: {f.model_code || "-"}
                          </p>
                          <p className="mt-1 text-xs text-zinc-400">
                            생성일:{" "}
                            {f.created_datetime
                              ? new Date(f.created_datetime).toLocaleDateString()
                              : "-"}
                          </p>
                          <div className="mt-3">{getStatusBadge(status || f.progress_status, progress)}</div>
                          {f.progress_status === "RUNNING" && (
                            <>
                              {/* <div className="mt-2 w-full bg-zinc-200 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${f.progress}%` }}
                                />
                              </div> */}
                              <ModelProgressSSE targetId={f.id} initialProgress={f.progress} setValue={setProgress} setStatus={setStatus} />
                            </>
                          )}
                        </div>
                      </div>
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
                        <th className="px-6 py-3 font-semibold">파일명</th>
                        <th className="px-6 py-3 font-semibold">모델코드</th>
                        <th className="px-6 py-3 font-semibold">상태</th>
                        <th className="px-6 py-3 font-semibold">진행률</th>
                        <th className="px-6 py-3 font-semibold">생성일</th>
                        <th className="px-6 py-3 font-semibold text-center">이동</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 bg-white">
                      {files.map((f) => (
                        <tr key={f.id} className="hover:bg-blue-50/40 transition">
                          <td className="px-6 py-3 text-zinc-700">{f.id}</td>
                          <td className="px-6 py-3 font-medium text-zinc-900">{f.file_name}</td>
                          <td className="px-6 py-3 text-zinc-600">{f.model_code || "-"}</td>
                          <td className="px-6 py-3">{getStatusBadge(status || f.progress_status, f.progress)}</td>
                          <td className="px-6 py-3 text-zinc-600">{f.progress}%</td>
                          <td className="px-6 py-3 text-zinc-500">
                            {f.created_datetime
                              ? new Date(f.created_datetime).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {status === "COMPLETED" || f.progress_status === "COMPLETED" ? (
                              <Link
                                href={`/file/${f.id}`}
                                className="inline-block rounded-lg border border-blue-600 px-3 py-1 text-sm font-medium text-blue-600 hover:bg-blue-600 hover:text-white transition"
                              >
                                이동
                              </Link>
                            ) : (
                              <span className="text-zinc-400 text-sm">진행중</span>
                            )}
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
                    className={`px-3 py-1 rounded border text-sm ${num === page
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
