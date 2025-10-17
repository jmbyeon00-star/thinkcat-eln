/* File: pages/collection/index.tsx */
"use client";

import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Folder, Database, FileText, Search, LayoutGrid, Table } from "lucide-react";

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
  // const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
  const API_BASE = "http://192.168.1.20:8000";
  console.log(">>>", API_BASE)

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);

  // 검색 & 페이지네이션 상태
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  // 보기 모드 (grid / table)
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // 📡 데이터 로드
  useEffect(() => {
    async function loadCollections() {
      try {
        setLoading(true);
        const res = await fetch(
          `${API_BASE}/api/collection?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
            credentials: "include",
          }
        );
        const data = await res.json();
        setCollections(data.items || []);
        setTotal(data.total || 0);
      } catch (e) {
        console.error(e);
        alert("컬렉션 목록을 불러오지 못했습니다.");
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

  const iconMapper = (type?: string) => {
    switch (type) {
      case "DB":
        return <Database className="h-5 w-5 text-zinc-700" />;
      case "FILE":
        return <FileText className="h-5 w-5 text-zinc-700" />;
      default:
        return <Folder className="h-5 w-5 text-zinc-700" />;
    }
  };
  console.log(collections)

  return (
    <>
      <Head>
        <title>컬렉션 관리 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
        <div className="mx-auto max-w-6xl">
          {/* 제목 + 보기 전환 버튼 */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                컬렉션 관리
              </h1>
              <p className="mt-1 text-sm md:text-base text-zinc-500">
                등록된 컬렉션 목록입니다.
              </p>
            </div>

            {/* 보기 전환 버튼 */}
            <button
              onClick={() =>
                setViewMode((prev) => (prev === "grid" ? "table" : "grid"))
              }
              className="flex items-center gap-2 rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              {viewMode === "grid" ? (
                <>
                  <Table className="h-4 w-4" /> 테이블 보기
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
              placeholder="컬렉션 이름 검색..."
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
          ) : collections.length === 0 ? (
            <p className="mt-6 text-sm text-zinc-500">검색 결과가 asdfasdf없습니다.</p>
          ) : viewMode === "grid" ? (
            /* 🧩 카드형 보기 */
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collection/${c.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                      {iconMapper(c.source_type)}
                    </div>
                    <div>
                      <h2 className="text-lg font-medium text-zinc-900">
                        {c.collection_name}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-500">
                        {c.project_name || "관련 프로젝트 없음"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {c.collection_category ? `${c.collection_category}번` : "분류 없음"} ·{" "}
                        {c.data_count ? `${c.data_count}개 데이터` : "0개 데이터"} ·{" "}
                        {c.created_datetime
                          ? new Date(c.created_datetime).toLocaleDateString()
                          : "-"}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            /* 📊 테이블형 보기 */
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full text-sm border border-zinc-200 rounded-lg">
                <thead className="bg-zinc-100">
                  <tr>
                    <th className="px-4 py-2 text-left">이름</th>
                    <th className="px-4 py-2 text-left">프로젝트</th>
                    <th className="px-4 py-2 text-left">카테고리</th>
                    <th className="px-4 py-2 text-left">생성일</th>
                    <th className="px-4 py-2 text-left">상세보기</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t hover:bg-zinc-50 transition"
                    >
                      <td className="px-4 py-2 font-medium">
                        {c.collection_name}
                      </td>
                      <td className="px-4 py-2">
                        {c.project_name || "관련 없음"}
                      </td>
                      <td className="px-4 py-2">
                        {c.collection_category ?? "-"}
                      </td>
                      <td className="px-4 py-2">
                        {c.created_datetime
                          ? new Date(c.created_datetime).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/collection/${c.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          보기
                        </Link>
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
        </div>
      </main>
    </>
  );
}
