// pages/project/[project_id]/index.tsx (혹은 해당 페이지 파일)
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { Database, Cpu, TrendingUp, Plus, Zap } from "lucide-react";

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import Link from "next/link";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

type projectDetail = {
    id: number;
    source_type: string;
    task_type: string;
    project_status: number;
    project_code: string;
    project_name: string;
    project_description: string;
    collection_num: number;
    labeled_documents: number; // 오타 수정 (labeled_document -> labeled_documents)
    unlabeled_document: number;
    model_count: number;
    mean_score: number;
    created_datetime: string;
    updated_datetime: string;
};

type modelDetail = {
    id: number;
    model_code: string;
    task_type: string;
    source_type: string;
    data_scope: string;
    model_name: string;
    model_desc: string;
    model_version: string;
    accuracy: number; // 오타 수정 완료
    epoch: number;
    learning_rate: number;
    batch_size: number;
    max_length: number;
    shuffle: boolean;
    created_datetime: string;
    updated_datetime: string;
    status: string; // 임시 데이터에 status가 있어 추가했습니다.
}

// 임시 데이터 (더미 데이터는 로딩 상태와 관련 없으므로 그대로 유지)
const projectData = {
    // ... (더미 데이터는 그대로 유지)
    status: "진행중",
    recentActivities: [
        { action: "모델 '100-13' 학습 완료", time: "2시간 전" },
        { action: "데이터 50개 추가", time: "1일 전" },
        { action: "프로젝트 생성", time: "3일 전" },
    ],
};

export default function ProjectHomePage() {
    const router = useRouter();
    // project_id가 배열일 경우 대비하여 첫 번째 요소만 사용
    const project_id = Array.isArray(router.query.project_id)
        ? router.query.project_id[0]
        : router.query.project_id;

    const { data: session } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    // 🔴 [수정] projectInfo의 초기값을 null로 설정
    const [projectInfo, setProjectInfo] = useState<projectDetail | null>(null);
    const [models, setModels] = useState<modelDetail[]>([])

    // 🔴 [핵심 수정] 초기값을 true로 설정하여 페이지 진입 시 스켈레톤을 바로 표시
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // project_id나 token이 없으면 API 호출을 막고 대기
        if (!project_id || !token) return;

        async function loadPreview() {
            setLoading(true); // API 호출 직전에 다시 로딩 상태로 설정 (혹시 모를 재시도 대비)
            try {
                const res = await fetch(`${API_BASE}/api/project/${project_id}/detail`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("데이터를 불러오지 못했습니다.");
                const data = await res.json();

                setProjectInfo(data.project_info || null);
                setModels(data.models || []);
            } catch (e) {
                console.error("데이터 로딩 오류:", e);
                // 오류 발생 시에도 로딩을 false로 해제하여 스켈레톤을 멈춥니다.
                // 대신 오류 메시지 UI를 보여주는 것이 좋습니다.
            } finally {
                setLoading(false); // 로딩 완료
            }
        }
        loadPreview();
    }, [project_id, token, API_BASE]);

    // ⭐️ [핵심] ProjectLayout에 loading prop을 전달합니다.
    return (
        <ProjectLayout
            projectNo={projectInfo?.id}
            projectName={projectInfo?.project_name}
            projectDesc={projectInfo?.project_description}
            CreatedDatetime={projectInfo?.created_datetime}
            UpdatedDatetime={projectInfo?.updated_datetime}
            sourceType={projectInfo?.source_type}
            isLoading={loading} // 🔴 [핵심 수정] 로딩 상태를 Layout에 전달
        >
            <div className="space-y-6">
                {/* 프로젝트 개요 */}
                {/* <section className="bg-white rounded-lg border border-zinc-200 p-6">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">프로젝트 개요</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Calendar className="h-4 w-4" />
                            <span>생성일: {projectInfo?.created_datetime ? setDatetimeToDate(projectInfo.created_datetime) : '정보 없음'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Calendar className="h-4 w-4" />
                            <span>수정일: {projectInfo?.updated_datetime ? setDatetimeToDate(projectInfo.updated_datetime) : '정보 없음'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {projectData.status}
                            </span>
                        </div>
                    </div>
                </section> */}

                {/* 통계 카드 */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">총 데이터</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.labeled_documents ?? '-'}
                                    <span className="text-lg text-zinc-600">개</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Database className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">학습된 모델</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.model_count ?? '-'}
                                    <span className="text-lg text-zinc-600">개</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <Cpu className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">평균 정확도</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.mean_score != null ? projectInfo.mean_score.toFixed(2) : '-'}
                                    <span className="text-lg text-zinc-600">%</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 베스트 모델 */}
                <section className="bg-white rounded-lg border border-zinc-200 p-6">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">베스트 모델</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {models.length > 0 ? models.slice(0, 3).map((model) => (
                            <div
                                key={model.id}
                                className="border border-zinc-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium text-zinc-900">{model.model_name}</h3>
                                    <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                        {model.status || '완료'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-zinc-600">분류 모델</span>
                                </div>
                                <div className="mt-3">
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-zinc-600">정확도</span>
                                        <span className="font-semibold text-zinc-900">{(model.accuracy * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="w-full bg-zinc-200 rounded-full h-2">
                                        <div
                                            className="bg-blue-600 h-2 rounded-full"
                                            style={{ width: `${model.accuracy * 100}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )) : (
                            // 모델 데이터가 없을 경우 표시
                            <div className="text-zinc-500 col-span-3">아직 학습된 모델이 없습니다.</div>
                        )}
                    </div>
                </section>

                {/* 최근 활동 & 빠른 작업 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 최근 활동 더미*/}
                    <section className="bg-white rounded-lg border border-zinc-200 p-6">
                        <h2 className="text-lg font-semibold text-zinc-900 mb-4">최근 활동(Dummy)</h2>
                        <div className="space-y-3">
                            {projectData.recentActivities.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                    <div className="flex-grow">
                                        <p className="text-sm text-zinc-900">{activity.action}</p>
                                        <p className="text-xs text-zinc-500">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 빠른 작업 */}
                    <section className="bg-white rounded-lg border border-zinc-200 p-6">
                        <h2 className="text-lg font-semibold text-zinc-900 mb-4">빠른 작업</h2>
                        <div className="space-y-3">
                            <Link
                                // projectInfo가 있을 때만 유효한 href 설정
                                href={projectInfo ? `/project/${projectInfo.id}/data/${projectInfo.source_type?.toLowerCase()}` : "#"}
                                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                        <Plus className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900">컬렉션 관리</p>
                                        <p className="text-sm text-zinc-600">컬렉션을 관리합니다</p>
                                    </div>
                                </div>
                                <Zap className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                            </Link>

                            <Link
                                // projectInfo가 있을 때만 유효한 href 설정
                                // href={projectInfo && projectInfo.collection_num && projectInfo.labeled_documents ?
                                //     `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                //     projectInfo && !projectInfo.collection_num && !projectInfo.labeled_documents ?
                                //         `/project/${projectInfo.id}/collection` :
                                //         projectInfo && projectInfo.collection_num && !projectInfo.labeled_documents ?
                                //             `/project/${projectInfo.id}/models/${projectInfo.source_type}` :
                                //             "#"}
                                href={projectInfo && projectInfo.collection_num ?
                                    `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                    projectInfo && !projectInfo.collection_num ?
                                        `/project/${projectInfo.id}/collection` :
                                        "#"}
                                className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                                        <Cpu className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900">새 모델 생성</p>
                                        <p className="text-sm text-zinc-600">새로운 AI
                                            모델을 학습시킵니다
                                        </p>
                                    </div>
                                </div>
                                <Zap className="h-5 w-5 text-zinc-400 group-hover:text-purple-600 transition-colors" />
                            </Link>
                        </div>
                    </section>
                </div>

            </div>
        </ProjectLayout>
    );
}