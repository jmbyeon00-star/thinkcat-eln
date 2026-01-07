"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import React from "react";

import {
  ArrowLeft,
  Database,
  FileText,
  Folder,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  BarChart3,
  PieChart as PieChartIcon,
  ChevronDown,
} from "lucide-react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import RecommendationPanel from "@components/collection/RecommendationPanel"


// Pie 차트 색상
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF6B9D', '#C084FC', '#34D399'
];

// 날짜 포맷 함수
const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

type CollectionDetail = {
  id: number;
  collection_name: string;
  collection_code: string;
  collection_category?: string;
  project_names?: string[];
  data_count?: number;
  created_datetime?: string;
  task_type: string;
  source_type: string;
  data_scope: string;
  mean_vector?: string;
};

type ProjectData = {
  id: number;
  title?: string;
  abstract?: string;
  applicant_name?: string;
  application_number?: string;
  application_date?: string;
};

type AnalysisData = {
  date_result: Record<string, number>;
  business_result: Array<{
    applicant_code: string;
    name: string;
    count: number;
  }>;
};

export default function CollectionDetailIntegratedPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id ? String(params.id) : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const { data: session, status } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [dataItems, setDataItems] = useState<ProjectData[]>([]);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // ✅ 통합 데이터 조회
  async function fetchCollection(pageNum = 1) {
    if (!id || !token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/collection/${id}?page=${pageNum}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();

      setCollection(data.collection);
      setDataItems(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotalCount(data.total || 0);
      setPage(data.page || 1);

      setAnalysisData({
        date_result: data.date_result || {},
        business_result: data.business_result || []
      });
    } catch (err) {
      console.error("Failed to fetch collection:", err);
      alert("컬렉션 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCollection(page);
  }, [id, page, limit, token]);

  const toggleRow = (rowId: number) => {
    setExpandedRow(prev => prev === rowId ? null : rowId);
  };

  const truncateText = (text: string | undefined, maxLength: number = 100) => {
    if (!text) return "-";
    return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
  };

  const getYearChartData = () => {
    if (!analysisData?.date_result) return [];
    return Object.entries(analysisData.date_result)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({
        year: year + '년',
        count: count as number
      }));
  };

  const getCompanyChartData = () => {
    if (!analysisData?.business_result) return [];
    return analysisData.business_result.map((company: any) => ({
      name: company.name || '이름 없음',
      value: company.count,
      code: company.applicant_code
    }));
  };

  const handlePieClick = (data: any) => {
    const code = data.code;
    if (code) {
      router.push(`/search/company/${code}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="animate-spin h-6 w-6" />
          <span className="text-lg">불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-500">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

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

  const sourceInfo = getSourceIcon(collection.source_type);
  const yearChartData = getYearChartData();
  const companyChartData = getCompanyChartData();

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-blue-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>뒤로가기</span>
        </button>

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className={`rounded-xl bg-gradient-to-br ${sourceInfo.bg} p-4 ring-1 ${sourceInfo.ring}`}>
              {sourceInfo.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">
                {collection.collection_name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-zinc-600">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>코드: {collection.collection_code}</span>
                </div>
                {collection.created_datetime && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                    <span>{formatDate(collection.created_datetime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="font-semibold text-blue-600">{totalCount.toLocaleString()}건</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 분석 차트 섹션 */}
        {(yearChartData.length > 0 || companyChartData.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {yearChartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-semibold text-zinc-900">연도별 출원 건수</h2>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={yearChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="year" tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any) => [`${value}건`, '출원 건수']}
                      />
                      <Bar
                        dataKey="count"
                        fill="#3B82F6"
                        name="출원 건수"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {companyChartData.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-emerald-100">
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-emerald-600" />
                    <h2 className="text-lg font-semibold text-zinc-900">상위 출원인 (Top 10)</h2>
                  </div>
                </div>
                <div className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={companyChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => {
                          const percent = entry.percent || 0;
                          return `${(percent * 100).toFixed(0)}%`;
                        }}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        onClick={handlePieClick}
                        style={{ cursor: 'pointer' }}
                      >
                        {companyChartData.map((_entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any, name: any) => [`${value}건`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Data Table Section */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <h2 className="text-lg font-semibold text-zinc-900">컬렉션 데이터</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider w-20">
                      번호
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      제목
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      {collection.mean_vector ? '출원인' : '요약'}
                    </th>
                    {collection.mean_vector && (
                      <>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          출원번호
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                          출원일
                        </th>
                      </>
                    )}
                    {!collection.mean_vector && (
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        컬렉션명
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dataItems.length > 0 ? (
                    dataItems.map((d, idx) => {
                      const isExpanded = expandedRow === d.id;
                      return (
                        <React.Fragment key={d.id}>
                          <tr
                            className="hover:bg-blue-50 transition-colors cursor-pointer"
                            onClick={() => toggleRow(d.id)}
                          >
                            <td className="px-6 py-4 text-sm text-zinc-500">
                              {(page - 1) * limit + idx + 1}
                            </td>
                            <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                              <div className="flex items-center gap-2">
                                <span>{d.title ?? "-"}</span>
                                <ChevronDown
                                  className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''
                                    }`}
                                />
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-zinc-600">
                              {collection.mean_vector
                                ? (d.applicant_name ?? "-")
                                : truncateText(d.abstract, 100)
                              }
                            </td>
                            {collection.mean_vector && (
                              <>
                                <td className="px-6 py-4 text-sm text-zinc-600">
                                  {d.application_number ?? "-"}
                                </td>
                                <td className="px-6 py-4 text-sm text-zinc-600">
                                  {formatDate(d.application_date)}
                                </td>
                              </>
                            )}
                            {!collection.mean_vector && (
                              <td className="px-6 py-4 text-sm text-zinc-600">
                                {collection.collection_name ?? "-"}
                              </td>
                            )}
                          </tr>
                          {isExpanded && !collection.mean_vector && (
                            <tr className="bg-gradient-to-r from-blue-50 to-indigo-50">
                              <td colSpan={4} className="px-6 py-4">
                                <div className="bg-white rounded-lg p-6 border border-blue-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                    <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                    <h4 className="text-sm font-semibold text-zinc-900">요약문</h4>
                                  </div>
                                  <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap">
                                    {d.abstract || "요약문이 없습니다."}
                                  </p>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={collection.mean_vector ? 5 : 4} className="px-6 py-12 text-center text-zinc-500">
                        등록된 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <ChevronLeft className="w-4 h-4 -ml-2" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-4 text-sm text-zinc-700">
                      페이지 <span className="font-semibold text-blue-600">{page}</span> / {totalPages}
                    </span>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4 -ml-2" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">행 개수</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(parseInt(e.target.value, 10));
                        setPage(1);
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {[5, 10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}/페이지
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* AI Model Training Section */}
        {collection.mean_vector && (
          <RecommendationPanel collection={collection} setDataItems={setDataItems} token={token} />
        )}

        {!collection.mean_vector && (
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl shadow-sm border border-yellow-200 p-8">
            <div className="flex items-start gap-4">
              <div className="rounded-xl bg-yellow-100 p-3">
                <Sparkles className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-900 mb-2">
                  AI 추천 모델 사용 불가
                </h3>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  이 컬렉션은 출원번호(Application Number) 없이 등록되었으며, AI 추천 모델 학습 및 추론 기능을 사용할 수 없습니다.
                  <br />
                  출원번호가 포함된 컬렉션으로 다시 시도해주세요.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

