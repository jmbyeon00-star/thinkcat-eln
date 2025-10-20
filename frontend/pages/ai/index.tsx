"use client"; 

import { useEffect, useState } from "react";
import { CircleDashed, CircleCheckBig, AlertCircle, Search, LayoutGrid, Table, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useSession } from "next-auth/react";
import type { Session, getServerSession } from "next-auth";
import { useRouter } from "next/router";

type Model = {
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

const statusConfig = {
  RUNNING: {
    icon: CircleDashed,
    label: "학습 중",
    color: "text-blue-600",
    bg: "from-blue-50 to-cyan-50",
    ring: "ring-blue-100",
    badge: "bg-blue-100 text-blue-700 border-blue-200",
  },
  COMPLETED: {
    icon: CircleCheckBig,
    label: "학습 완료",
    color: "text-emerald-600",
    bg: "from-emerald-50 to-teal-50",
    ring: "ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  FAILED: {
    icon: AlertCircle,
    label: "학습 실패",
    color: "text-red-600",
    bg: "from-red-50 to-pink-50",
    ring: "ring-red-100",
    badge: "bg-red-100 text-red-700 border-red-200",
  },
};

// 간단한 진행률 표시 컴포넌트
const ProgressBar = ({ progress, status }: { progress: number; status: string }) => {
  const getColorClass = () => {
    if (status === "FAILED") return "bg-red-500";
    if (progress === 100) return "bg-emerald-500";
    return "bg-blue-500";
  };

  const getTextColor = () => {
    if (progress < 50) return "text-zinc-700";
    return "text-white";
  };

  return (
    <div className="mt-4">
      <div className="relative w-full bg-zinc-200 rounded-full h-6 overflow-hidden">
        <div
          className={`h-6 rounded-full transition-all duration-500 ${getColorClass()}`}
          style={{ width: `${progress}%` }}
        />
        <span
          className={`absolute inset-0 text-xs font-semibold flex items-center justify-center ${getTextColor()}`}
        >
          {progress}%
        </span>
      </div>
    </div>
  );
};

export default function AIModelListPage() {
    const API_BASE = "http://192.168.1.20:8000";

    const [models, setModels] = useState<Model[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(6);
    const [total, setTotal] = useState(0);
    const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

    const router = useRouter();
    const { data: session, status } = useSession() as { 
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated"; 
    };
    const token = session?.access_token;
    const user = session?.user;

    if (!user) {
        
    }


    useEffect(() => {
        if (!token) return;
        async function loadModels() {
            try {
                setIsLoading(true);
                
                const res = await fetch(
                    `${API_BASE}/api/ai?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, { 
                        headers: {
                            Authorization: `Bearer ${token}`,
                        },
                        credentials: "include" 
                });
                const data = await res.json();
                setModels(data.items || []);
                setTotal(data.total || 0);
            } catch (e) {
                console.error("AI 모델 목록 로드 실패:", e);
            } finally {
                setIsLoading(false);
            }
        }

        const debounce = setTimeout(loadModels, 300);
        return () => clearTimeout(debounce);
    }, [token, query, page, limit]);

    const totalPages = Math.ceil(total / limit);

    const getPageNumbers = () => {
        const pages: number[] = [];
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    };

    // 상태별 모델 카운트
    const statusCounts = {
        running: models.filter(m => m.progress_status === "RUNNING").length,
        completed: models.filter(m => m.progress_status === "COMPLETED").length,
        failed: models.filter(m => m.progress_status === "FAILED").length,
    };

    return (
        <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-8">
            <div>
                <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-8 h-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-zinc-900">
                    인공지능 관리
                </h1>
                </div>
                <p className="text-zinc-600">
                AI 모델을 학습하고 관리하세요
                </p>
            </div>

            {/* View Toggle */}
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
                placeholder="모델 이름으로 검색..."
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
            <div className="mb-6 grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CircleDashed className="w-5 h-5 text-blue-600" />
                    <span className="text-sm font-medium text-zinc-700">학습 중</span>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                    {statusCounts.running}
                </span>
                </div>
            </div>

            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CircleCheckBig className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-medium text-zinc-700">완료</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                    {statusCounts.completed}
                </span>
                </div>
            </div>

            <div className="bg-gradient-to-r from-zinc-50 to-zinc-100 rounded-xl p-4 border border-zinc-200">
                <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-zinc-500 rounded-full"></div>
                    <span className="text-sm font-medium text-zinc-700">전체</span>
                </div>
                <span className="text-2xl font-bold text-zinc-700">
                    {total}
                </span>
                </div>
            </div>
            </div>

            {/* Loading State */}
            {isLoading ? (
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
                        <div className="mt-4 h-6 bg-zinc-100 rounded-full"></div>
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
            ) : models.length === 0 ? (
            /* Empty State */
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-zinc-400" />
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
                {models.map((m) => {
                    const config = statusConfig[m.progress_status];
                    const Icon = config.icon;
                    
                    return (
                    <a
                        key={m.id}
                        href={m.progress_status === "RUNNING" ? `/ai/training/${m.id}` : `/ai/${m.id}`}
                        className="block group"
                    >
                        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6 hover:shadow-xl hover:border-blue-200 transition-all duration-300">
                        <div className="flex items-start gap-4">
                            {/* Icon */}
                            <div className={`rounded-xl bg-gradient-to-br ${config.bg} p-3 ring-1 ${config.ring} group-hover:ring-blue-300 transition-all`}>
                            <Icon className={`h-6 w-6 ${config.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <h2 className="text-lg font-semibold text-zinc-900 group-hover:text-blue-600 transition-colors truncate">
                                {m.model_name}
                                </h2>
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${config.badge}`}>
                                {config.label}
                                </span>
                            </div>

                            <p className="text-sm text-zinc-600 mb-3 line-clamp-2">
                                {m.model_desc || "설명이 없습니다"}
                            </p>

                            <div className="flex items-center gap-3 text-xs text-zinc-500">
                                <div className="flex items-center gap-1">
                                <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                <span>{taskMapper[m.task_type] ?? m.task_type}</span>
                                </div>
                                {m.created_datetime && (
                                <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                                    <span>
                                    {new Date(m.created_datetime).toLocaleDateString()}
                                    </span>
                                </div>
                                )}
                            </div>
                            </div>
                        </div>

                        {/* Progress Bar */}
                        {m.progress_status === "RUNNING" && (
                            <ProgressBar progress={m.progress} status={m.progress_status} />
                        )}
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
                        모델 이름
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        설명
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        작업 유형
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        진행률
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
                    {models.map((m) => {
                        const config = statusConfig[m.progress_status];
                        const Icon = config.icon;
                        
                        return (
                        <tr key={m.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div className={`rounded-lg bg-gradient-to-br ${config.bg} p-2 ring-1 ${config.ring}`}>
                                <Icon className={`h-5 w-5 ${config.color}`} />
                                </div>
                                <span className="font-medium text-zinc-900">
                                {m.model_name}
                                </span>
                            </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600 max-w-xs truncate">
                            {m.model_desc || "설명 없음"}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600">
                            <span className="px-2 py-1 bg-zinc-100 rounded-md text-xs font-medium">
                                {taskMapper[m.task_type] ?? m.task_type}
                            </span>
                            </td>
                            <td className="px-6 py-4">
                            {m.progress_status === "RUNNING" ? (
                                <div className="relative w-32 bg-zinc-200 rounded-full h-5">
                                <div
                                    className={`h-5 rounded-full transition-all duration-500 ${
                                    m.progress === 100 ? "bg-emerald-500" : "bg-blue-500"
                                    }`}
                                    style={{ width: `${m.progress}%` }}
                                />
                                <span className={`absolute inset-0 text-xs font-semibold flex items-center justify-center ${
                                    m.progress < 50 ? "text-zinc-700" : "text-white"
                                }`}>
                                    {m.progress}%
                                </span>
                                </div>
                            ) : (
                                <span className={`px-2 py-1 rounded-md text-xs font-medium border ${config.badge}`}>
                                {config.label}
                                </span>
                            )}
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600">
                            {m.created_datetime
                                ? new Date(m.created_datetime).toLocaleDateString()
                                : "-"}
                            </td>
                            <td className="px-6 py-4">
                            <a
                                href={m.progress_status === "RUNNING" ? `/ai/training/${m.id}` : `/ai/${m.id}`}
                                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
                            >
                                {m.progress_status === "RUNNING" ? "모니터링" : "상세보기"}
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