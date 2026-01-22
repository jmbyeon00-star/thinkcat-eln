import { useEffect, useState, useCallback } from "react";
import Head from "next/head";
import {
  Database,
  UploadCloud,
  Search,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Loader2,
  AlertCircle,
  Plus,
  Calendar,
  Zap
} from "lucide-react";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import { authHeader } from "@/utils/common";
import { api } from "@/lib/apiClient";
import { withMessages } from '@/lib/i18n/withMessages';
import Link from "next/link";

export const getServerSideProps = withMessages();

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
  0: { label: "데이터 준비", color: "bg-blue-50 text-blue-600 border-blue-100" },
  1: { label: "전처리 중", color: "bg-cyan-50 text-cyan-600 border-cyan-100" },
  2: { label: "모델 학습", color: "bg-indigo-50 text-indigo-600 border-indigo-100" },
  3: { label: "성능 평가", color: "bg-purple-50 text-purple-600 border-purple-100" },
  4: { label: "배포 완료", color: "bg-emerald-50 text-emerald-600 border-emerald-100" },
};

export default function ProjectListPage() {
  const { data: session } = useSession() as {
    data: (Session & { access_token?: string }) | null;
  };
  const token = session?.access_token;

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  const loadProjects = useCallback(async (isSilent = false) => {
    if (!token) return;
    try {
      if (!isSilent) setLoading(true);
      const res = await api.get(`/api/project`, {
        params: { page, limit, query },
        headers: authHeader(token),
      });
      setProjects(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error("로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [token, page, limit, query]);

  useEffect(() => {
    const debounce = setTimeout(loadProjects, 300);
    return () => clearTimeout(debounce);
  }, [loadProjects]);

  const handleDelete = async (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(`'${project.project_name}' 프로젝트를 삭제하시겠습니까?\nGPU 서버 내의 모든 데이터가 영구 삭제됩니다.`)) {
      return;
    }

    try {
      setIsDeleting(project.id);
      await api.delete(`/api/project/${project.id}/delete`, {
        headers: authHeader(token),
      });
      alert("프로젝트와 연동된 리소스가 삭제되었습니다.");
      loadProjects(true);
    } catch (err: any) {
      alert(err.response?.data?.message || "삭제 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(null);
    }
  };

  const totalPages = Math.ceil(total / limit);
  const getPageNumbers = () => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-white selection:bg-blue-100">
      <Head>
        <title>프로젝트 관리 | IPFORCE</title>
      </Head>

      {/* 1. 글로벌 삭제 로딩 오버레이 */}
      {isDeleting && (
        <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-full border-4 border-zinc-100 border-t-blue-600 animate-spin" />
            <Trash2 className="absolute inset-0 m-auto text-zinc-300" size={24} />
          </div>
          <h2 className="text-2xl font-black text-zinc-900 tracking-tighter mb-2">GPU 리소스 정리 중</h2>
          <p className="font-bold text-zinc-400">서버 내 하위 폴더와 가중치 데이터를 영구 삭제하고 있습니다.</p>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-8 py-16">

        {/* 2. 페이지 헤더 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="space-y-4">
            <h1 className="text-5xl font-black text-zinc-900 tracking-tighter leading-none">
              프로젝트 관리<span className="text-blue-600">.</span>
            </h1>
            <p className="text-zinc-500 font-medium text-lg leading-relaxed">
              활성화된 분석 프로젝트와 <br className="hidden md:block" /> GPU 서버 리소스를 실시간으로 제어하세요.
            </p>
          </div>
          <Link href="/project/new" className="group flex items-center gap-3 bg-zinc-900 text-white px-8 py-5 rounded-[1.5rem] font-black hover:bg-black transition-all hover:scale-[1.02] active:scale-[0.98] shadow-2xl">
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            새 프로젝트 생성
          </Link>
        </div>

        {/* 3. 검색 및 요약 대시보드 */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12">
        <div className="lg:col-span-3 relative group mb-6">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-blue-600 transition-colors" size={20} />
          <input
            type="text"
            placeholder="프로젝트 이름을 검색하세요..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full rounded-[1.5rem] border border-zinc-100 bg-zinc-50/50 pl-14 pr-6 py-5 text-sm font-bold focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
          />
        </div>
        <div className="bg-blue-600 rounded-[1.5rem] p-5 flex items-center justify-between text-white shadow-xl shadow-blue-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 rounded-xl"><Zap size={20} className="fill-white" /></div>
              <span className="text-xs font-black uppercase tracking-widest">Active</span>
            </div>
            <span className="text-3xl font-black tracking-tighter">{total.toLocaleString()}</span>
          </div>
        {/* </div> */}

        <div className="mb-6"><div className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-300" /><input type="text" placeholder="프로젝트 이름으로 검색..." value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="w-full rounded-2xl border border-zinc-200 pl-12 pr-4 py-4 text-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition-all outline-none" /></div></div>
        <div className="mb-8 bg-zinc-50 rounded-2xl p-5 border flex items-center justify-between"><div className="flex items-center gap-3"><div className="p-2 bg-blue-600 rounded-lg"><Database className="w-5 h-5 text-white" /></div><span className="text-sm font-bold text-zinc-600">전체 프로젝트 개수</span></div><span className="text-3xl font-black text-blue-600">{total.toLocaleString()}</span></div>

        {/* 4. 프로젝트 리스트 Grid */}
        {loading ? (
          <div className="grid gap-8 md:grid-cols-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-zinc-50 rounded-[2.5rem] animate-pulse border border-zinc-100" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-zinc-50 rounded-[3rem] p-24 border border-dashed border-zinc-200 text-center flex flex-col items-center animate-in zoom-in-95 duration-700">
            <AlertCircle className="w-16 h-16 text-zinc-200 mb-6" />
            <h3 className="text-xl font-black text-zinc-400">등록된 프로젝트가 없습니다.</h3>
            <p className="text-zinc-300 font-bold mt-2">첫 번째 AI 분석 프로젝트를 시작해 보세요.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-8 md:grid-cols-2 mb-16">
              {projects.map((p, idx) => {
                const statusInfo = statusMapper[p.project_status] || { label: "알 수 없음", color: "bg-zinc-100 text-zinc-700" };
                return (
                  <Link key={p.id} href={`/project/${p.id}`} className="group relative animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 100}ms` }}>
                    <div className="h-full bg-white rounded-[2.5rem] border border-zinc-100 p-8 shadow-sm hover:shadow-2xl hover:border-blue-100 transition-all duration-500 flex flex-col relative overflow-hidden">

                      {/* 삭제 버튼 */}
                      <button
                        onClick={(e) => handleDelete(e, p)}
                        disabled={isDeleting !== null}
                        className="absolute top-8 right-8 p-3 text-zinc-200 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all z-10"
                      >
                        <Trash2 size={20} />
                      </button>

                      <div className="flex items-start gap-6 mb-8">
                        <div className="rounded-2xl bg-zinc-50 p-4 group-hover:bg-blue-600 group-hover:text-white transition-all duration-500 shadow-inner">
                          {p.source_type === "search" ? <Database size={28} /> : <UploadCloud size={28} />}
                        </div>
                        <div className="flex-1 min-w-0 pr-10">
                          <h2 className="text-2xl font-black text-zinc-900 group-hover:text-blue-600 transition-colors truncate tracking-tighter mb-2">{p.project_name}</h2>
                          <p className="text-zinc-400 font-bold text-sm line-clamp-2 leading-relaxed">
                            {p.project_description || "프로젝트 상세 설명이 등록되지 않았습니다."}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between pt-6 border-t border-zinc-50">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-1.5 text-zinc-400 font-black text-[10px] uppercase tracking-widest">
                            <Calendar size={12} />
                            {p.created_datetime && new Date(p.created_datetime).toLocaleDateString()}
                          </div>
                          <span className="px-3 py-1 bg-zinc-100 rounded-lg text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                            {taskMapper[p.task_type] ?? p.task_type}
                          </span>
                        </div>
                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* 5. 세련된 Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-14 h-14 rounded-2xl border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 disabled:opacity-30 transition-all text-zinc-400">
                  <ChevronLeft size={24} />
                </button>
                <div className="flex gap-3">
                  {getPageNumbers().map((num) => (
                    <button
                      key={num}
                      onClick={() => setPage(num)}
                      className={`w-14 h-14 rounded-2xl text-sm font-black transition-all ${num === page ? "bg-blue-600 text-white shadow-xl shadow-blue-100" : "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"}`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-14 h-14 rounded-2xl border border-zinc-100 flex items-center justify-center hover:bg-zinc-50 disabled:opacity-30 transition-all text-zinc-400">
                  <ChevronRight size={24} />
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}