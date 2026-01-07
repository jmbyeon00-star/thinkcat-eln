"use client";

import { useEffect, useState } from "react";
import { Database, UploadCloud, Search, ChevronLeft, ChevronRight } from "lucide-react";

type Project = {
  id: number;
  project_name: string;
  project_description?: string;
  source_type: "search" | "upload";
  project_status: number;
  task_type: string;
  created_datetime?: string;
};

const taskMapper: Record<string, string> = {
  classification: "이진분류",
  "multi-label": "다중분류",
  regression: "회귀",
  etc: "기타",
};

const statusMapper: Record<number, { label: string; color: string }> = {
  0: { label: "1/5단계", color: "bg-blue-100 text-blue-700 border-blue-200" },
  1: { label: "2/5단계", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  2: { label: "3/5단계", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  3: { label: "4/5단계", color: "bg-purple-100 text-purple-700 border-purple-200" },
  4: { label: "생성완료", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

export default function ProjectListPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function loadProjects() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/project?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setProjects(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error("프로젝트 목록 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(loadProjects, 300);
    return () => clearTimeout(debounce);
  }, [query, page, limit]);

  const totalPages = Math.ceil(total / limit);

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
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            프로젝트 관리
          </h1>
          <p className="text-zinc-600">
            등록된 프로젝트를 관리하고 모니터링하세요
          </p>
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="프로젝트 이름으로 검색..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-zinc-200 pl-12 pr-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium text-zinc-700">
                전체 프로젝트
              </span>
            </div>
            <span className="text-2xl font-bold text-blue-600">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-zinc-100 rounded-xl"></div>
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-zinc-100 rounded w-3/4"></div>
                      <div className="h-4 bg-zinc-100 rounded w-full"></div>
                      <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-zinc-400" />
            </div>
            <p className="text-lg font-medium text-zinc-900 mb-2">
              검색 결과가 없습니다
            </p>
            <p className="text-sm text-zinc-500">
              다른 검색어로 다시 시도해보세요
            </p>
          </div>
        ) : (
          <>
            {/* Project Grid */}
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {projects.map((p) => {
                const statusInfo = statusMapper[p.project_status] || {
                  label: "알 수 없음",
                  color: "bg-zinc-100 text-zinc-700 border-zinc-200",
                };

                return (
                  <a
                    key={p.id}
                    href={`/project/${p.id}`}
                    className="block group"
                  >
                    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-3 ring-1 ring-blue-100 group-hover:ring-blue-300 transition-all">
                          {p.source_type === "search" ? (
                            <Database className="h-6 w-6 text-blue-600" />
                          ) : (
                            <UploadCloud className="h-6 w-6 text-indigo-600" />
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                              {p.project_name}
                            </h2>
                            <span
                              className={`px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </div>

                          <p className="text-sm text-zinc-600 mb-3 line-clamp-2">
                            {p.project_description || "설명이 없습니다"}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-zinc-500">
                            <div className="flex items-center gap-1">
                              <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                              <span>{taskMapper[p.task_type] ?? p.task_type}</span>
                            </div>
                            {p.created_datetime && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                <span>
                                  {new Date(p.created_datetime).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex gap-1">
                  {getPageNumbers().map((num) => (
                    <button
                      key={num}
                      onClick={() => setPage(num)}
                      className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all ${num === page
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md"
                        : "border border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                        }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div >
  );
}