import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, PieLabelRenderProps, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { AlertTriangle, ChevronDown, BarChart3, FileText, CheckCircle, XCircle, ArrowLeft, ArrowRight, Loader2, PieChartIcon, BarChart2, ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "next-auth/react";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

// --- 타입 정의 ---
type GroupStatItem = {
  name: string;
  value: number;
};

type GroupInfo = {
  code: string;
  total: number;
};

type ProjectInfo = {
  id: number;
  project_code: string;
  project_name: string;
  project_description: string;
  project_status: number;
  source_type: string;
  task_type: string;
  collection_num: number;
  labeled_documents: number;
  unlabeled_documents: number;
  created_datetime: string;
};

type CollectionInfo = {
  id: number;
  collection_name: string;
  collection_data_num: number;
  collection_data_ratio: number;
  collection_category: number;
};

type StatsResponse = {
  project_info: ProjectInfo;
  collection_info: CollectionInfo[]; // 전체 컬렉션 마스터 정보
  group_list: GroupInfo[];           // SELECT 박스용 그룹 목록
  group_distribution: Record<string, GroupStatItem[]>; // 그룹별 컬렉션 분포 데이터
};

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-1">{payload[0].name}</p>
        <p className="text-sm text-zinc-600">
          문서 수: <span className="font-bold text-zinc-900">{payload[0].value.toLocaleString()}개</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function ProjectStatsPage() {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { project_id } = router.query;

  const { data: session } = useSession() as any;
  const token = session?.access_token;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'pie' | 'bar'>('pie');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const itemsPerPage = 10;
  const MIN_PER_GROUP = 5;

  useEffect(() => {
    if (!project_id || !token) return;
    setLoading(true);
    fetch(`${API_BASE}/api/project/${project_id}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error("통계 불러오기 실패:", err))
      .finally(() => setLoading(false));
  }, [project_id, token, API_BASE]);

  // --- 데이터 필터링 로직 ---
  const groupDistribution = stats?.group_distribution ?? {};

  // 1. 차트와 테이블에 사용할 핵심 데이터 (선택된 그룹에 따라 결정)
  const currentChartData = useMemo(() => {
    if (selectedGroup === "all") {
      const totalMap: Record<string, number> = {};
      Object.values(groupDistribution).flat().forEach((item) => {
        totalMap[item.name] = (totalMap[item.name] || 0) + item.value;
      });
      return Object.entries(totalMap).map(([name, value]) => ({ name, value }));
    }
    return groupDistribution[selectedGroup] ?? [];
  }, [groupDistribution, selectedGroup]);

  // 2. 현재 화면에 표시되는 총 문서 수
  const currentTotalDocs = useMemo(() => {
    return currentChartData.reduce((acc, cur) => acc + cur.value, 0);
  }, [currentChartData]);

  // 3. 페이지네이션 데이터
  const totalPages = Math.ceil(currentChartData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return currentChartData.slice(startIndex, startIndex + itemsPerPage);
  }, [currentChartData, currentPage]);

  // 4. 학습 가능 여부 (전체 마스터 컬렉션 정보 기준 유지)
  const invalidCollections = useMemo(
    () => (stats?.collection_info ?? []).filter((c) => (c.collection_data_num ?? 0) < MIN_PER_GROUP),
    [stats]
  );
  const canProceed = invalidCollections.length === 0 && (stats?.collection_info.length ?? 0) > 0;

  const goNext = () => {
    if (!canProceed) {
      const lines = invalidCollections
        .slice(0, 8)
        .map((g) => `- ${g.collection_name || "(미분류)"}: ${g.collection_data_num}개 (필요: ${MIN_PER_GROUP}+)`)
        .join("\n");
      alert(`일부 컬렉션의 데이터가 부족합니다.\n\n${lines}\n\n데이터를 보강해주세요.`);
      return;
    }
    router.push({
      pathname: `/project/train/${project_id}`,
      query: {
        collection_num: stats?.project_info?.collection_num ?? "",
        source_type: stats?.project_info?.source_type ?? "",
        task_type: stats?.project_info?.task_type ?? "",
      },
    });
  };

  if (loading) {
    return (
      <ProjectLayout>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mr-3" />
          <span className="text-zinc-600 font-medium">통계 데이터를 분석하는 중...</span>
        </div>
      </ProjectLayout>
    );
  }

  if (!stats) return <ProjectLayout><div className="p-20 text-center">데이터를 불러오지 못했습니다.</div></ProjectLayout>;

  return (
    <ProjectLayout
      projectNo={stats.project_info.id}
      projectName={stats.project_info.project_name}
      projectDesc={stats.project_info.project_description}
      taskType={stats.project_info?.task_type}
      sourceType={stats.project_info?.source_type}
      collectionNum={stats.project_info?.collection_num}
      CreatedDatetime={stats.project_info.created_datetime}
      UpdatedDatetime={stats.project_info.updated_datetime}
    >
      <div className="min-h-screen bg-white p-8">
        {/* 헤더 섹션 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-blue-700 rounded-full" />
              <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">파일 통계</h1>
            </div>
            <p className="text-zinc-500 ml-4 font-medium">데이터 그룹 및 클래스별 분포 현황입니다.</p>
          </div>

          {/* 그룹 필터 셀렉트 */}
          <div className="relative min-w-[300px] group">
            <label className="block text-xs font-bold text-zinc-400 mb-1.5 ml-1 uppercase">Group Filter</label>
            <div className="relative">
              <select
                value={selectedGroup}
                onChange={(e) => {
                  setSelectedGroup(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full appearance-none bg-zinc-50 border-2 border-zinc-200 text-zinc-700 py-3 px-4 pr-10 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold cursor-pointer shadow-sm group-hover:border-zinc-300"
              >
                <option value="all">전체 프로젝트 (All Groups)</option>
                {stats.group_list.map((g) => (
                  <option key={g.code} value={g.code}>
                    {g.code} ({g.total.toLocaleString()}건)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-8">
          {/* 수치 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-zinc-100 shadow-xl shadow-zinc-200/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-50 rounded-lg"><FileText className="text-blue-600 w-5 h-5" /></div>
                <h3 className="text-sm font-bold text-zinc-500">데이터 수</h3>
              </div>
              <p className="text-4xl font-black text-zinc-900">{currentTotalDocs.toLocaleString()}</p>
              <p className="text-xs text-zinc-400 mt-2 font-medium">
                {selectedGroup === "all" ? "프로젝트 전체 데이터 건수" : `${selectedGroup} 그룹 데이터 건수`}
              </p>
            </div>
            {/* 필요시 라벨링 완료/미라벨 카드도 여기에 같은 스타일로 추가 가능 */}
          </div>

          {/* 차트 영역 */}
          <div className="bg-white rounded-[2rem] shadow-2xl shadow-zinc-200/60 border border-zinc-100 overflow-hidden">
            <div className="bg-indigo-600 px-8 py-6 flex justify-between items-center">

              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <PieChartIcon size={22} className="text-blue-400" />
                  클래스 분포
                </h2>
              </div>
              <div className="flex bg-white/10 p-1 rounded-xl">
                <button onClick={() => setChartType('pie')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${chartType === 'pie' ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-400 hover:text-white'}`}>원형</button>
                <button onClick={() => setChartType('bar')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${chartType === 'bar' ? 'bg-white text-zinc-900 shadow-lg' : 'text-zinc-400 hover:text-white'}`}>막대</button>
              </div>
            </div>
            <div className="p-10">
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'pie' ? (
                    <PieChart>
                      <Pie
                        data={currentChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={150}
                        innerRadius={80}
                        paddingAngle={5}
                        // label={({ name, percent }) => `${name} (${(percent * 100).toFixed(1)}%)`}
                        label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`}
                      >
                        {currentChartData.map((_, idx) => <Cell key={`idx-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  ) : (
                    <BarChart data={currentChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} tick={{ fill: '#888', fontSize: 12 }} />
                      <YAxis tick={{ fill: '#888', fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                        {currentChartData.map((_, idx) => <Cell key={`idx-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 테이블 영역 */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-zinc-100 overflow-hidden">
            <div className="px-8 py-6 border-b border-zinc-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-zinc-900">상세 리스트</h2>
              <span className="bg-blue-50 text-blue-700 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                {currentChartData.length} Classes Found
              </span>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className="px-8 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">컬렉션 명</th>
                    <th className="px-8 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-widest">데이터 수</th>
                    <th className="px-8 py-4 text-right text-xs font-bold text-zinc-400 uppercase tracking-widest">비율(%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedData.map((item, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[((currentPage - 1) * itemsPerPage + idx) % COLORS.length] }} />
                          <span className="font-bold text-zinc-700 group-hover:text-blue-700 transition-colors">{item.name}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right font-black text-zinc-900">{item.value.toLocaleString()}</td>
                      <td className="px-8 py-5 text-right">
                        <span className="inline-block px-3 py-1 bg-zinc-100 rounded-lg text-xs font-bold text-zinc-500">
                          {((item.value / currentTotalDocs) * 100).toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* 페이지네이션 버튼 */}
              {totalPages > 1 && (
                <div className="p-6 border-t border-zinc-50 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-all"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${currentPage === page ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-zinc-100 text-zinc-600'}`}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-xl border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50 transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 이전/다음 액션 버튼 */}
          <div className="flex justify-between items-center pt-10">
            <button
              onClick={() => router.push(`/project/preview/${project_id}`)}
              className="flex items-center gap-2 px-8 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
            >
              <ArrowLeft size={20} /> 이전 단계
            </button>
            <button
              onClick={goNext}
              className={`flex items-center gap-2 px-10 py-4 rounded-2xl font-bold transition-all shadow-xl ${canProceed ? 'bg-indigo-600 text-white hover:bg-indigo-800 shadow-zinc-300' : 'bg-indigo-200 text-indigo-400 cursor-not-allowed shadow-none'}`}
            >
              학습 설정 <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
}