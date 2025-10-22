import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, PieLabelRenderProps, Legend } from "recharts";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { BarChart3, AlertTriangle, FileText, CheckCircle, XCircle, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

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
  collection_info: CollectionInfo[];
};

const COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-1">{payload[0].name}</p>
        <p className="text-sm text-zinc-600">
          문서 수: <span className="font-bold text-zinc-900">{payload[0].value}개</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function ProjectStatsPage() {
  const router = useRouter();
  const API_BASE = "http://192.168.1.20:8000";
  const { project_id } = router.query;

  const { data: session, status: sessionStatus } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const MIN_PER_GROUP = 5;

  useEffect(() => {
    if (!project_id) return;
    setLoading(true);
    fetch(`${API_BASE}/api/project/${project_id}/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then(setStats)
      .catch((err) => console.error("통계 불러오기 실패:", err))
      .finally(() => setLoading(false));
  }, [project_id]);

  const projectInfo = stats?.project_info;
  const collectionInfo: CollectionInfo[] = stats?.collection_info ?? [];

  const totalDocs = useMemo(() => {
    const labeled = projectInfo?.labeled_documents ?? 0;
    const unlabeled = projectInfo?.unlabeled_documents ?? 0;
    return labeled + unlabeled;
  }, [projectInfo]);

  const pieData = useMemo(
    () =>
      collectionInfo.map((c) => ({
        name: c.collection_name,
        value: c.collection_data_num,
      })),
    [collectionInfo]
  );

  const invalidGroups = useMemo(
    () => collectionInfo.filter((c) => (c.collection_data_num ?? 0) < MIN_PER_GROUP),
    [collectionInfo]
  );
  const canProceed = invalidGroups.length === 0 && collectionInfo.length > 0;

  const goNext = () => {
    if (!canProceed) {
      const lines = invalidGroups
        .slice(0, 8)
        .map((g) => `- ${g.collection_name || "(미분류)"}: ${g.collection_data_num}개 (필요: ${MIN_PER_GROUP}+)`)
        .join("\n");
      alert(
        `아래 그룹은 문서 수가 ${MIN_PER_GROUP}개 미만이라 학습을 시작할 수 없습니다.\n\n${lines}${invalidGroups.length > 8 ? `\n… 외 ${invalidGroups.length - 8}개 그룹` : ""
        }\n\n라벨 분포를 보강한 뒤 다시 시도해주세요.`
      );
      return;
    }
    router.push({
      pathname: `/project/train/${project_id}`,
      query: {
        collection_num: projectInfo?.collection_num ?? "",
        source_type: projectInfo?.source_type ?? "",
        task_type: projectInfo?.task_type ?? "",
      },
    });
  };

  if (loading) {
    return (
      <ProjectLayout step={4}>
        <div className="flex min-h-screen items-center justify-center bg-white">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-zinc-600">통계 불러오는 중...</span>
          </div>
        </div>
      </ProjectLayout>
    );
  }

  if (!stats) {
    return (
      <ProjectLayout step={4}>
        <div className="min-h-screen bg-white p-8">
          <div className="max-w-4xl mx-auto">
            <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-700 font-semibold">통계를 불러오지 못했습니다.</p>
            </div>
          </div>
        </div>
      </ProjectLayout>
    );
  }

  return (
    <ProjectLayout step={4}>
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Warning Banner */}
          {!canProceed && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 shadow-lg">
              <div className="flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-amber-900 mb-2">학습 시작 조건 미충족</h3>
                  <p className="text-sm text-amber-800 mb-3">
                    각 컬렉션에 최소 <strong>{MIN_PER_GROUP}개</strong> 이상의 데이터가 필요합니다.
                  </p>
                  <div className="space-y-1">
                    {invalidGroups.slice(0, 5).map((g) => (
                      <div key={g.id} className="text-sm text-amber-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full" />
                        <span className="font-medium">{g.collection_name || "(미분류)"}</span>
                        <span className="text-amber-600">
                          {g.collection_data_num}개 (부족: {MIN_PER_GROUP - (g.collection_data_num ?? 0)}개)
                        </span>
                      </div>
                    ))}
                    {invalidGroups.length > 5 && (
                      <div className="text-sm text-amber-700 ml-4">… 외 {invalidGroups.length - 5}개 컬렉션</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-semibold text-white">총 데이터</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-3xl font-bold text-zinc-900">{totalDocs.toLocaleString()}</p>
                <p className="text-sm text-zinc-500 mt-1">전체 문서 수</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-semibold text-white">라벨링 완료</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-3xl font-bold text-emerald-600">
                  {(projectInfo?.labeled_documents ?? 0).toLocaleString()}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  {totalDocs > 0 ? `${((projectInfo?.labeled_documents ?? 0) / totalDocs * 100).toFixed(1)}%` : '0%'}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
              <div className="bg-gradient-to-r from-zinc-500 to-zinc-600 px-6 py-4">
                <div className="flex items-center gap-3">
                  <XCircle className="w-5 h-5 text-white" />
                  <h3 className="text-sm font-semibold text-white">미라벨</h3>
                </div>
              </div>
              <div className="p-6">
                <p className="text-3xl font-bold text-zinc-600">
                  {(projectInfo?.unlabeled_documents ?? 0).toLocaleString()}
                </p>
                <p className="text-sm text-zinc-500 mt-1">컬렉션 필요</p>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-white" />
                <h2 className="text-xl font-semibold text-white">컬렉션 분포</h2>
              </div>
              <p className="text-blue-100 text-sm mt-2">컬렉션별 데이터 분포를 확인하세요</p>
            </div>

            <div className="p-8">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        // 수정: PieLabelRenderProps 타입 사용 및 payload에서 percent 추출
                        label={(props: PieLabelRenderProps) => {
                          const name = props.name as string;
                          const percent = props.percent as number; // percent가 포함되어 있다면 사용
                          // 만약 props.percent가 undefined라면, payload에서 ratio를 가져와 percent를 계산할 수 있습니다.
                          // 하지만 간단한 해결을 위해 props에 percent가 있다고 가정하고 안전하게 사용합니다.
                          // Recharts는 내부적으로 percent 값을 전달하는 경우가 많습니다.

                          // 안전하게 percent가 있는지 확인 후 사용
                          if (percent) {
                            return `${name} (${(percent * 100).toFixed(1)}%)`;
                          }

                          // percent가 없을 경우, 이름만 반환하거나 다른 로직을 적용
                          return name;
                        }}
                        labelLine={{ stroke: '#64748b', strokeWidth: 1 }}
                      >
                        {pieData.map((_, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Table Section */}
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <h2 className="text-xl font-semibold text-white">컬렉션별 상세 정보</h2>
            </div>

            <div className="p-8">
              <div className="overflow-hidden rounded-xl border-2 border-zinc-200">
                <table className="w-full">
                  <thead className="bg-zinc-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700">컬렉션</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-700">문서 수</th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-zinc-700">비율</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-zinc-700">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionInfo.map((c, idx) => {
                      const isInsufficient = c.collection_data_num < MIN_PER_GROUP;
                      return (
                        <tr
                          key={c.id}
                          className={`border-t border-zinc-200 transition-colors ${isInsufficient ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-blue-50'
                            }`}
                        >
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                              />
                              <span className="font-medium text-zinc-900">{c.collection_name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-zinc-900">
                            {c.collection_data_num.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-zinc-600">
                            {(c.collection_data_ratio * 100).toFixed(1)}%
                          </td>
                          <td className="px-4 py-3 text-center">
                            {isInsufficient ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                <AlertTriangle size={12} />
                                부족 ({MIN_PER_GROUP - c.collection_data_num}개)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                                <CheckCircle size={12} />
                                정상
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push(`/project/preview/${project_id}`)}
              className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-300 font-medium transition-all flex items-center gap-2"
            >
              <ArrowLeft size={18} />
              이전 단계
            </button>

            <button
              onClick={goNext}
              disabled={!canProceed}
              className={`px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2 ${canProceed
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                : 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                }`}
              title={
                canProceed
                  ? '학습 페이지로 이동'
                  : `모든 라벨이 최소 ${MIN_PER_GROUP}개 이상이어야 이동할 수 있습니다.`
              }
            >
              학습 시작
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </ProjectLayout>
  );
}