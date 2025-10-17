// File: pages/project/index.tsx
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

// API_BASE는 네놈 환경에 맞게 자동으로 골라 씀
const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  "";

// 상태 배지 스타일
const statusChip = (s: string) => {
  const map: Record<string, string> = {
    ready: "bg-neutral-100 text-neutral-700",
    running: "bg-blue-100 text-blue-800",
    done: "bg-emerald-100 text-emerald-800",
    failed: "bg-rose-100 text-rose-800",
  };
  return map[s] ?? "bg-neutral-100 text-neutral-700";
};

type Project = {
  id: string | number;
  name: string;
  created_at: string;   // ISO
  item_count?: number;  // 특허 수 등
  status?: "ready" | "running" | "done" | "failed";
  owner?: string;
};

export default function ProjectListPage() {
  const [data, setData] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  // TODO: 백엔드 경로 맞게 변경
  // FastAPI라면 보통 /api/project 같은 REST가 있을 것.
  const endpoint = useMemo(() => {
    const base = API_BASE?.replace(/\/$/, "");
    return base ? `${base}/api/project` : "/api/project";
  }, []);

  const fetchList = async () => {
    try {
      setLoading(true);
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json?.projects ?? json ?? []);
    } catch (e) {
      // 실패 시 임시 목업 데이터로라도 표시 (백엔드 붙이기 전)
      setData([
        {
          id: "p_demo_1",
          name: "반도체 공정 특허 수집",
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          item_count: 1248,
          status: "running",
          owner: "you",
        },
        {
          id: "p_demo_2",
          name: "배터리 열폭주 분석",
          created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
          item_count: 312,
          status: "done",
          owner: "you",
        },
        {
          id: "p_demo_3",
          name: "AI+IP 스타트업 스크리닝",
          created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
          item_count: 57,
          status: "ready",
          owner: "team",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!q.trim()) return data;
    const key = q.trim().toLowerCase();
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(key) ||
        String(p.id).toLowerCase().includes(key)
    );
  }, [data, q]);

  return (
    <>
      <Head>
        <title>프로젝트 목록 | IPFORCE</title>
      </Head>

      {/* 전체 중앙 정렬 */}
      <main className="min-h-[72vh] flex items-center justify-center bg-white">
        <div className="w-full max-w-5xl px-5 md:px-8 py-10 md:py-14">
          {/* 헤더: 중앙 */}
          <header className="text-center">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-neutral-900">
              프로젝트
            </h1>
            <p className="mt-2 text-sm md:text-base text-neutral-600">
              진행 중이거나 완료된 프로젝트를 확인하세요.
            </p>

            {/* 액션: 검색 + 새 프로젝트 (중앙 정렬) */}
            <div className="mt-6 flex flex-col items-center justify-center gap-3">
              <div className="w-full max-w-xl">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="프로젝트 이름 또는 ID로 검색"
                  className="w-full rounded-lg border border-neutral-300 px-4 py-2.5 text-[15px] outline-none focus:ring-2 focus:ring-neutral-800/30"
                />
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/project/new"
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800 transition"
                >
                  <Plus className="h-4 w-4" />
                  새 프로젝트
                </Link>
                <button
                  onClick={fetchList}
                  className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
                >
                  <RefreshCw className="h-4 w-4" />
                  새로고침
                </button>
              </div>
            </div>
          </header>

          {/* 목록 */}
          <section className="mt-10 md:mt-12">
            {loading ? (
              <Loader />
            ) : filtered.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {/* 데스크톱: 테이블 */}
                <div className="hidden md:block">
                  <div className="overflow-hidden rounded-xl border border-neutral-200">
                    <table className="w-full table-fixed border-collapse text-sm">
                      <thead className="bg-neutral-50 text-neutral-600">
                        <tr>
                          <th className="px-4 py-3 w-[42%] text-left font-medium">
                            이름
                          </th>
                          <th className="px-4 py-3 w-[18%] text-left font-medium">
                            생성일
                          </th>
                          <th className="px-4 py-3 w-[15%] text-left font-medium">
                            항목 수
                          </th>
                          <th className="px-4 py-3 w-[15%] text-left font-medium">
                            상태
                          </th>
                          <th className="px-4 py-3 w-[10%]" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-200">
                        {filtered.map((p) => (
                          <tr key={p.id} className="hover:bg-neutral-50">
                            <td className="px-4 py-3">
                              <Link
                                href={`/project/${p.id}`}
                                className="font-medium text-neutral-900 hover:underline"
                              >
                                {p.name}
                              </Link>
                              {p.owner && (
                                <span className="ml-2 text-neutral-400">
                                  · {p.owner}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {new Date(p.created_at).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-neutral-700">
                              {p.item_count ?? "-"}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={
                                  "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium " +
                                  statusChip(p.status ?? "ready")
                                }
                              >
                                {p.status ?? "ready"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Link
                                href={`/project/${p.id}`}
                                className="text-sm font-medium text-neutral-900 hover:underline"
                              >
                                열기
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 모바일: 카드 */}
                <div className="md:hidden space-y-3">
                  {filtered.map((p) => (
                    <Link
                      key={p.id}
                      href={`/project/${p.id}`}
                      className="block rounded-xl border border-neutral-200 p-4 hover:bg-neutral-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-neutral-900">
                            {p.name}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {new Date(p.created_at).toLocaleString()} ·{" "}
                            {p.item_count ?? "-"}건
                          </div>
                        </div>
                        <span
                          className={
                            "inline-flex items-center rounded-md px-2 py-1 text-[11px] font-medium " +
                            statusChip(p.status ?? "ready")
                          }
                        >
                          {p.status ?? "ready"}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Loader() {
  return (
    <div className="flex justify-center">
      <div className="animate-pulse w-full max-w-5xl">
        <div className="h-12 rounded-lg bg-neutral-100" />
        <div className="mt-3 h-12 rounded-lg bg-neutral-100" />
        <div className="mt-3 h-12 rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <p className="text-neutral-500">아직 생성된 프로젝트가 없습니다.</p>
      <Link
        href="/project/new"
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-neutral-900 bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-neutral-800"
      >
        <Plus className="h-4 w-4" />
        새 프로젝트 만들기
      </Link>
    </div>
  );
}
