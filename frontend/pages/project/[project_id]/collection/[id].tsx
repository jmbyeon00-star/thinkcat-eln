// ~/frontend/pages/project/[project_id]/collection/[id].tsx

import { useEffect, useState, useRef } from "react";
// import { useParams, useRouter } from "next/navigation";
import { useRouter } from "next/router";
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

import { useTranslations } from 'next-intl';
import { withMessages } from '@/lib/i18n/withMessages';
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { CollectionInfo } from "@/types/collection";
import { ProjectData } from "@/types/project";
export const getServerSideProps = withMessages();


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
type AnalysisData = {
  date_result: Record<string, number>;
  business_result: Array<{
    applicant_code: string;
    name: string;
    count: number;
  }>;
};

export default function CollectionDetailIntegratedPage() {
  // app router 방식
  // const params = useParams();
  // const id = params?.id ? String(params.id) : null;

  // page router 방식
  const router = useRouter();
  if (!router.isReady) return null;
  const id =
    typeof router.query.id === "string"
      ? router.query.id
      : null;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { project_id } = router.query;

  const { data: session, status } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const translator = useTranslations();

  const [collection, setCollection] = useState<CollectionInfo | null>(null);
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
      const res = await fetch(`${API_BASE}/api/collection/detail/${id}?page=${pageNum}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      console.log(">>> data.collection:", data.collection)
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
    <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-6xl mx-auto">

          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-blue-600 mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>뒤로가기</span>
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-8 bg-blue-700 rounded-full" />
              <h1 className="text-3xl font-bold text-zinc-900">
                컬렉션 상세보기
              </h1>
            </div>
            <p className="text-zinc-600">
              컬렉션을 관리하고 탐색하세요
            </p>
          </div>


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
          {/* Data Table Section */}
          <section className="mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
                <h2 className="text-lg font-semibold text-zinc-900">컬렉션 데이터</h2>
              </div>

              {/* table-fixed가 작동하려면 부모에 overflow-hidden이 중요합니다 */}
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                      {/* 너비 비중: 요약(50%) > 제목(25%) > 컬렉션명(20%) */}
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase w-16"></th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase w-[25%]">특허명</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase w-[50%]">
                        {collection.mean_vector ? '출원인' : '요약문'}
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase w-[20%]">
                        {collection.mean_vector ? '출원번호' : '클래스'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {dataItems.length > 0 ? (
                      dataItems.map((d, idx) => {
                        // const isExpanded = expandedRow === d.id;
                        const isExpanded = Number(expandedRow) === Number(d.id);
                        return (
                          <React.Fragment key={d.id}>
                            <tr
                              className={`hover:bg-blue-50/50 transition-colors cursor-pointer ${isExpanded ? 'bg-blue-50/50' : ''}`}
                              // onClick={() => toggleRow(d.id)}
                              onClick={() => d.id && toggleRow(Number(d.id))}
                            >
                              <td className="px-6 py-4 text-sm text-zinc-500 whitespace-nowrap">{((page - 1) * limit) + idx + 1}</td>

                              {/* 제목 컬럼: truncate 적용 */}
                              <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="truncate block" title={d.title ?? ""}>{d.title ?? "-"}</span>
                                  {/* <ChevronDown className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} /> */}
                                </div>
                              </td>

                              {/* 요약/출원인 컬럼: truncate 적용 */}
                              <td className="px-6 py-4 text-sm text-zinc-600">
                                <div className="truncate w-full" title={collection.mean_vector ? (d.applicant_name ?? "") : (d.abstract ?? "")}>
                                  {collection.mean_vector ? (d.applicant_name ?? "-") : (d.abstract ?? "-")}
                                </div>
                              </td>

                              {/* 컬렉션명 컬럼: truncate 적용 */}
                              <td className="px-6 py-4 text-sm text-zinc-600">
                                <div className="truncate w-full"
                                  // title={collection.mean_vector ? (d.application_number ?? "") : (collection.collection_name ?? "")}
                                  title={collection.mean_vector ? String(d.application_number ?? "") : String(collection.collection_name ?? "")}
                                >
                                  {collection.mean_vector ? (d.application_number ?? "-") : (collection.collection_name ?? "-")}
                                </div>
                              </td>
                            </tr>

                            {/* 확장 영역: 제목, 요약문, 컬렉션명 모두 표시 */}
                            {isExpanded && (
                              <tr className="bg-zinc-50/50">
                                <td colSpan={4} className="px-6 py-6">
                                  <div className="bg-white rounded-xl p-6 border border-zinc-200 shadow-sm space-y-4">
                                    <div>
                                      <span className="text-[12px] font-bold text-blue-600 uppercase tracking-wider">특허명</span>
                                      <h4 className="text-base font-bold text-zinc-900 mt-1">{d.title ?? "제목 없음"}</h4>
                                    </div>
                                    <div>
                                      <span className="text-[12px] font-bold text-indigo-600 uppercase tracking-wider">요약문</span>
                                      <p className="text-sm text-zinc-700 leading-relaxed bg-zinc-50 p-4 rounded-lg border border-zinc-100 mt-1 whitespace-pre-wrap">
                                        {d.abstract || "내용이 없습니다."}
                                      </p>
                                    </div>
                                    <div className="flex gap-10 pt-2">
                                      <div>
                                        <span className="text-[12px] font-bold text-blue-600 uppercase tracking-wider block">클래스</span>
                                        <span className="text-sm font-semibold text-zinc-700">{collection.collection_name}</span>
                                      </div>
                                      {collection.mean_vector && (
                                        <div>
                                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Application No.</span>
                                          <span className="text-sm font-semibold text-zinc-700">{d.application_number}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">데이터가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 사라졌던 페이지네이션 복구 */}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    {/* 왼쪽: 페이지 번호 컨트롤 */}
                    <div className="flex items-center gap-1">
                      {/* 처음으로 */}
                      <button
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <ChevronLeft className="w-4 h-4 -ml-2" />
                      </button>

                      {/* 이전 */}
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 mr-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      {/* 페이지 숫자 버튼 5개 로직 */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const buttons = [];
                          // 현재 페이지 기준으로 앞뒤 범위를 계산 (총 5개)
                          let startPage = Math.max(1, page - 2);
                          let endPage = Math.min(totalPages, startPage + 4);

                          // 마지막 페이지 근처일 때 시작 페이지 재조정
                          if (endPage - startPage < 4) {
                            startPage = Math.max(1, endPage - 4);
                          }

                          for (let i = startPage; i <= endPage; i++) {
                            buttons.push(
                              <button
                                key={i}
                                onClick={() => setPage(i)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${page === i
                                  ? "bg-blue-600 text-white shadow-md shadow-blue-100"
                                  : "bg-white border border-zinc-200 text-zinc-600 hover:border-blue-400 hover:text-blue-600"
                                  }`}
                              >
                                {i}
                              </button>
                            );
                          }
                          return buttons;
                        })()}
                      </div>

                      {/* 다음 */}
                      <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 ml-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* 끝으로 */}
                      <button
                        onClick={() => setPage(totalPages)}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4" />
                        <ChevronRight className="w-4 h-4 -ml-2" />
                      </button>
                    </div>

                    {/* 오른쪽: 행 개수 선택 */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Show</span>
                      <select
                        value={limit}
                        onChange={(e) => {
                          setLimit(parseInt(e.target.value, 10));
                          setPage(1);
                        }}
                        className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all cursor-pointer bg-white"
                      >
                        {[5, 10, 20, 50, 100].map((n) => (
                          <option key={n} value={n}>
                            {n} rows
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
            <RecommendationPanel collection={collection} dataItems={dataItems} setDataItems={setDataItems} token={token} />
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
    </ProjectLayout>
  );
}

