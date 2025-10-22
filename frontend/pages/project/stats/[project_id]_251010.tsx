import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import ProjectLayout from "@/components/layouts/ProjectLayout";

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

export default function ProjectStatsPage() {
    const router = useRouter();
    const { project_id } = router.query;
    const [stats, setStats] = useState<StatsResponse | null>(null);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

    useEffect(() => {
        if (!project_id) return;
        fetch(`${API_BASE}/api/project/${project_id}/stats`)
            .then((res) => res.json())
            .then(setStats)
            .catch((err) => console.error("통계 불러오기 실패:", err));
    }, [project_id]);

    if (!stats) {
        return (
            <div className="flex min-h-[200px] items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
                <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
            </div>
        );
    }

    const { project_info, collection_info } = stats;
    const totalDocs =
        (project_info.labeled_documents ?? 0) +
        (project_info.unlabeled_documents ?? 0);

    const pieData = collection_info.map((c) => ({
        label: c.collection_name,
        count: c.collection_data_num,
    }));

    const MIN_PER_GROUP = 5;
    // ✅ 학습 가능 여부 계산
    const invalidGroups = useMemo(
        () => collection_info.filter((c) => (c.collection_data_num ?? 0) < MIN_PER_GROUP),
        [collection_info]
    );
    const canProceed = invalidGroups.length === 0 && collection_info.length > 0;

    // ✅ 라우팅 가드
    const goNext = () => {
        if (!canProceed) {
            const lines = invalidGroups
                .slice(0, 8) // 너무 길면 일부만
                .map(
                    (g) =>
                        `- ${g.collection_name || "(미분류)"}: ${g.collection_data_num}개 (필요: ${MIN_PER_GROUP}+)`
                )
                .join("\n");
            alert(
                `아래 그룹은 문서 수가 ${MIN_PER_GROUP}개 미만이라 학습을 시작할 수 없습니다.\n\n${lines}${invalidGroups.length > 8 ? `\n… 외 ${invalidGroups.length - 8}개 그룹` : ""
                }\n\n라벨 분포를 보강한 뒤 다시 시도해주세요.`
            );
            return;
        }
        router.push(`/project/train/${project_id}`);
    };

    return (
        <ProjectLayout step={4}>
            <div className="p-6 space-y-6">
                <h1 className="text-2xl font-bold">
                    프로젝트 #{project_id} 통계
                </h1>

                {/* 🚨 경고 배너 */}
                {!canProceed && (
                    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-800">
                        <div className="font-semibold mb-1">
                            학습을 시작하려면 각 라벨(그룹)에 최소 {MIN_PER_GROUP}개 이상의 데이터가 필요합니다.
                        </div>
                        <div className="text-sm leading-6">
                            {invalidGroups.slice(0, 5).map((g) => (
                                <div key={g.id}>
                                    • <span className="font-medium">{g.collection_name || "(미분류)"}</span>{" "}
                                    {g.collection_data_num}개 (부족: {Math.max(0, MIN_PER_GROUP - (g.collection_data_num ?? 0))}개)
                                </div>
                            ))}
                            {invalidGroups.length > 5 && (
                                <div>… 외 {invalidGroups.length - 5}개 그룹</div>
                            )}
                        </div>
                    </div>
                )}

                {/* 개수 카드 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 border rounded-lg shadow-sm">
                        <p className="text-sm text-zinc-500">총 데이터</p>
                        <p className="text-2xl font-bold">{totalDocs}</p>
                    </div>
                    <div className="p-4 border rounded-lg shadow-sm">
                        <p className="text-sm text-zinc-500">라벨링 완료</p>
                        <p className="text-2xl font-bold">
                            {project_info.labeled_documents}
                        </p>
                    </div>
                    <div className="p-4 border rounded-lg shadow-sm">
                        <p className="text-sm text-zinc-500">미라벨</p>
                        <p className="text-2xl font-bold">
                            {project_info.unlabeled_documents}
                        </p>
                    </div>
                </div>

                {/* 라벨 분포 차트 */}
                <div className="h-72">
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={pieData}
                                dataKey="count"
                                nameKey="label"
                                outerRadius={120}
                                label
                            >
                                {pieData.map((_, idx) => (
                                    <Cell
                                        key={`cell-${idx}`}
                                        fill={
                                            ["#3b82f6", "#f97316", "#10b981", "#ef4444", "#8b5cf6"][
                                            idx % 5
                                            ]
                                        }
                                    />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* 라벨 상세 테이블 */}
                <div>
                    <h2 className="text-lg font-semibold mb-2">라벨별 상세</h2>
                    <table className="w-full border text-sm">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="border px-3 py-2 text-left">라벨</th>
                                <th className="border px-3 py-2 text-right">문서 수</th>
                                <th className="border px-3 py-2 text-right">비율</th>
                            </tr>
                        </thead>
                        <tbody>
                            {collection_info.map((c) => (
                                <tr key={c.id}>
                                    <td className="border px-3 py-2">{c.collection_name}</td>
                                    <td className="border px-3 py-2 text-right">
                                        {c.collection_data_num}
                                    </td>
                                    <td className="border px-3 py-2 text-right">
                                        {(c.collection_data_ratio * 100).toFixed(1)}%
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* 하단 네비게이션 */}
                <div className="flex justify-between mt-6 gap-2">
                    <button
                        onClick={() => router.push(`/project/preview/${project_id}`)}
                        className="rounded-lg bg-gray-200 text-gray-800 px-4 py-2 text-sm hover:bg-gray-300"
                    >
                        이전
                    </button>

                    <div className="flex gap-2">
                        {/* <button
                            onClick={() => router.push(`/project/train/${project_id}`)}
                            className="rounded-lg bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700"
                        >
                            다음
                        </button> */}
                        <button
                            onClick={goNext}
                            disabled={!canProceed}
                            className={`rounded-lg px-4 py-2 text-sm ${canProceed
                                    ? "bg-blue-600 text-white hover:bg-blue-700"
                                    : "bg-gray-200 text-gray-500 cursor-not-allowed"
                                }`}
                            title={
                                canProceed
                                    ? "학습 페이지로 이동"
                                    : `모든 라벨이 최소 ${MIN_PER_GROUP}개 이상이어야 이동할 수 있습니다.`
                            }
                        >
                            다음
                        </button>
                    </div>
                </div>
            </div>
        </ProjectLayout>
    );
}
