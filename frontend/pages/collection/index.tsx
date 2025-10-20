"use client"; 

import { useEffect, useState } from "react";
import { Folder, Database, FileText, Search, LayoutGrid, Table, ChevronLeft, ChevronRight } from "lucide-react";

type Collection = {
  id: number;
  collection_name: string;
  collection_code: string;
  collection_category?: string;
  project_name?: string;
  source_type?: string;
  mean_vector?: string;
  created_datetime?: string;
  data_count?: string;
};

export default function CollectionListPage() {
  const API_BASE = "http://192.168.1.20:8000";
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  useEffect(() => {
    async function loadCollections() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/collection?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        setCollections(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error("컬렉션 목록 로드 실패:", e);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(loadCollections, 300);
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

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case "DB":
        return { icon: <Database className="h-6 w-6 text-blue-600" />, bg: "from-blue-50 to-cyan-50", ring: "ring-blue-100" };
      case "FILE":
        return { icon: <FileText className="h-6 w-6 text-indigo-600" />, bg: "from-indigo-50 to-purple-50", ring: "ring-indigo-100" };
      default:
        return { icon: <Folder className="h-6 w-6 text-emerald-600" />, bg: "from-emerald-50 to-teal-50", ring: "ring-emerald-100" };
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              컬렉션 관리
            </h1>
            <p className="text-zinc-600">
              데이터 컬렉션을 관리하고 탐색하세요
            </p>
          </div>

          {/* View Toggle Button */}
          <button
            onClick={() => setViewMode((prev) => (prev === "grid" ? "table" : "grid"))}
            className="flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 hover:border-blue-300 transition-all shadow-sm"
          >
            {viewMode === "grid" ? (
              <>
                <Table className="h-4 w-4" />
                <span>테이블 보기</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-4 w-4" />
                <span>카드 보기</span>
              </>
            )}
          </button>
        </div>

        {/* Search Box */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="컬렉션 이름으로 검색..."
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
                전체 컬렉션
              </span>
            </div>
            <span className="text-2xl font-bold text-blue-600">
              {total.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          viewMode === "grid" ? (
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
          ) : (
            <div className="animate-pulse bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="h-12 bg-zinc-100"></div>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 border-t border-zinc-100 bg-white"></div>
              ))}
            </div>
          )
        ) : collections.length === 0 ? (
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
        ) : viewMode === "grid" ? (
          /* Grid View */
          <>
            <div className="grid gap-4 md:grid-cols-2 mb-8">
              {collections.map((c) => {
                const sourceInfo = getSourceIcon(c.source_type);
                return (
                  <a
                    key={c.id}
                    href={`/collection/${c.id}`}
                    className="block group"
                  >
                    <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div className={`rounded-xl bg-gradient-to-br ${sourceInfo.bg} p-3 ring-1 ${sourceInfo.ring} group-hover:ring-blue-300 transition-all`}>
                          {sourceInfo.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors mb-2 truncate">
                            {c.collection_name}
                          </h2>

                          <p className="text-sm text-zinc-600 mb-3 truncate">
                            {c.project_name || "관련 프로젝트 없음"}
                          </p>

                          <div className="flex items-center gap-3 text-xs text-zinc-500 flex-wrap">
                            {c.collection_category && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                <span>{c.collection_category}번</span>
                              </div>
                            )}
                            {c.data_count && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                <span className="font-medium text-blue-600">
                                  {parseInt(c.data_count).toLocaleString()}개
                                </span>
                              </div>
                            )}
                            {c.created_datetime && (
                              <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                <span>
                                  {new Date(c.created_datetime).toLocaleDateString()}
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
          </>
        ) : (
          /* Table View */
          <div className="mb-8 bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      컬렉션 이름
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      프로젝트
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      카테고리
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      데이터 수
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      작업
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {collections.map((c, idx) => {
                    const sourceInfo = getSourceIcon(c.source_type);
                    return (
                      <tr
                        key={c.id}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`rounded-lg bg-gradient-to-br ${sourceInfo.bg} p-2 ring-1 ${sourceInfo.ring}`}>
                              {sourceInfo.icon}
                            </div>
                            <span className="font-medium text-zinc-900">
                              {c.collection_name}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {c.project_name || "관련 없음"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {c.collection_category ? (
                            <span className="px-2 py-1 bg-zinc-100 rounded-md text-xs font-medium">
                              {c.collection_category}번
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {c.data_count ? (
                            <span className="font-semibold text-blue-600">
                              {parseInt(c.data_count).toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-zinc-400">0</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {c.created_datetime
                            ? new Date(c.created_datetime).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4">
                          <a
                            href={`/collection/${c.id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            상세보기
                            <ChevronRight className="h-4 w-4" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

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
                  className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    num === page
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
      </div>
    </div>
  );
}