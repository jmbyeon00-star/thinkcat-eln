// frontend/pages/project/[project_id]/models/new.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

// import { setDatetimeToDate } from "@/utils/common";
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import { ProjectInfo, ProjectDataGroups, ProjectGroupItems, DataSummary, TrainingConfig, TrainingDataItems } from "@/types/project";
import { CollectionInfo } from "@/types/collection";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { Step, StepSidebar, Step1Content, Step2Content, Step3Content } from "@/components/project/train/TrainingSettings";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export const MAX_STEP = 3;

// ----------------------------------------------------
// 메인 페이지 컴포넌트
// ----------------------------------------------------
export default function ProjectTrainPage() {
    const router = useRouter();
    const { project_id, collection_num, task_type, source_type } = router.query;
    const projectIdString = Array.isArray(project_id) ? project_id[0] : (project_id as string || '');

    const { setState } = useUserTaskStore();

    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { data: session } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [limit] = useState(5);
    const [page, setPage] = useState(1);
    const [query, setQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);

    const [isLoading, setIsLoading] = useState(false);
    const [isCollectionEditMode, setIsCollectionEditMode] = useState(false);
    const [collectionInfo, setCollectionInfo] = useState<CollectionInfo[] | []>([]);
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [projectDataGroups, setProjectDataGroups] = useState<ProjectDataGroups | null>(null);
    const [trainingDataItems, setTrainingDataItems] = useState<TrainingDataItems>([]);
    const [counterDataItems, setCounterDataItems] = useState<TrainingDataItems>([]);
    const [isCounterUsed, setIsCounterUsed] = useState(false); // 카운터 데이터 사용 여부


    // ----------------------------------------------------
    // 학습 플로우 상태 관리
    const [currentStep, setCurrentStep] = useState<Step>(Step.DATA_SELECTION);
    const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
    const [trainingConfig, setTrainingConfig] = useState<TrainingConfig | null>(null);
    // ----------------------------------------------------

    // 모델 정보 관리
    const [modelInfo, setModelInfo] = useState<any[]>([]);
    const [isModelLoading, setIsModelLoading] = useState(true);

    useEffect(() => {
        if (!token || !projectInfo?.id) return;

        const fetchModels = async () => {
            console.log(">")
            try {
                setIsModelLoading(true);
                const response = await fetch(`${API_BASE}/api/project/${projectInfo.id}/models`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                console.log("models in project:", data)
                setModelInfo(data || []); // 모델 리스트 저장
            } catch (error) {
                console.error("모델 호출 실패:", error);
            } finally {
                setIsModelLoading(false);
            }
        };
        fetchModels();
    }, [projectInfo?.id, token]);

    // 1. useCallback 내부의 로직을 확실히 보장
    const loadProjectDataGroup = useCallback(async () => {
        // router.isReady와 필수 값이 있는지 함수 진입 시점에 한 번 더 체크
        if (!router.isReady || !project_id || !token) {
            console.log("로딩 건너뜀:", { isReady: router.isReady, project_id, token });
            return;
        }

        try {
            setIsLoading(true);
            console.log("데이터 가져오는 중... ID:", project_id);

            const response = await fetch(`${API_BASE}/api/project/${project_id}/data/groups?page=${page}&limit=${limit}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                credentials: "include",
            });

            if (!response.ok) {
                console.error("서버 응답 에러");
                return;
            }

            const apiResponse = await response.json();

            // --- 상태 업데이트 로직 ---
            setCollectionInfo(apiResponse.collection_info || []);
            setProjectInfo(apiResponse.project_info);

            const dataGroups = apiResponse.project_data_groups || {};
            const groupCodes = Object.keys(dataGroups);

            if (groupCodes.length > 0) {
                const groups: ProjectGroupItems[] = groupCodes.map((groupCode) => {
                    const groupData = dataGroups[groupCode];
                    const dataList = groupData.data || [];
                    return {
                        group_code: groupCode,
                        group_name: dataList[0]?.collection_name || groupCode,
                        group_items: dataList,
                        count: groupData.count,
                        id: (page - 1) * limit + groupData.index,
                        last_updated: dataList[dataList.length - 1]?.created_at || new Date().toISOString(),
                    };
                });

                setProjectDataGroups({
                    total_count: apiResponse.total_count,
                    group_count: apiResponse.total_count,
                    groups: groups,
                    last_updated: groups[0]?.last_updated || new Date().toISOString(),
                });
                setTotalCount(apiResponse.total_count);
            } else {
                // 데이터가 없는 경우 처리
                setProjectDataGroups({ total_count: 0, group_count: 0, groups: [], last_updated: "" });
                setTotalCount(0);
            }

        } catch (error) {
            console.error("데이터 로드 중 예외 발생:", error);
        } finally {
            setIsLoading(false);
        }
    }, [project_id, token, page, limit, router.isReady]); // router.isReady를 의존성에 추가
    console.log(">>> projectDataGroups:", projectDataGroups)
    // 2. 실행부
    useEffect(() => {
        loadProjectDataGroup();
    }, [loadProjectDataGroup]); // 이제 loadProjectDataGroup이 변경될 때만 실행됨

    // ----------------------------------------------------
    // 위저드 네비게이션 로직
    // ----------------------------------------------------
    // ----------------------------------------------------
    // 위저드 네비게이션 로직
    // ----------------------------------------------------

    const goToNextStep = useCallback(() => {
        setCurrentStep(prev => Math.min(MAX_STEP, prev + 1));
    }, []);
    const handleStep1Next = async () => {
        setIsLoading(false);

        // 1) 저장할 payload 만들기
        const payload = {
            sources: dataSummary,
            items: trainingDataItems,
            n_items: counterDataItems,
        };

        // 2) 백엔드에 저장 요청
        // const res = await fetch(`${API_BASE}/api/project/${project_id}/data/insert`, {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json",
        //         Authorization: `Bearer ${token}`
        //     },
        //     body: JSON.stringify(payload)
        // });

        // if (!res.ok) {
        //     alert("데이터 저장 중 오류가 발생했습니다.");
        //     return;
        // }

        // 3) 저장이 성공하면 Step2로 이동
        goToNextStep();
    };

    const goToPreviousStep = useCallback(() => {
        setCurrentStep(prev => Math.max(Step.DATA_SELECTION, prev - 1));
        // setCurrentStep((prev) => {
        //     // 이전 단계 계산
        //     const nextStep = Math.max(Step.DATA_SELECTION, prev - 1);
        //     // 2단계
        //     if (prev === Step.TRAINING_CONFIG && nextStep === Step.DATA_SELECTION) {
        //         // 요청하신 3가지 변수 초기화
        //         setDataSummary(null);
        //         setTrainingDataItems([]);
        //         setCounterDataItems([]);
        //         // (참고) 만약 페이지 번호도 초기화하고 싶다면 추가
        //         setPage(1);
        //     }
        //     return nextStep;
        // });
    }, []);

    const handleStep1Select = useCallback((summary: DataSummary) => {
        setDataSummary(summary);
    }, []);

    const handleStep2ConfigChange = useCallback((config: TrainingConfig) => {
        setTrainingConfig(config);
    }, []);

    const handleStartTraining = useCallback(() => {
        if (!projectInfo) return;

        if (dataSummary && trainingConfig) {
            const dataset = {
                sources: dataSummary,
                items: trainingDataItems,
                n_items: counterDataItems,
                is_counter_used: isCounterUsed
            };
            console.log('Final Training Start Payload:', { dataSummary, trainingConfig, projectInfo, dataset });


            setState({ isBusy: true, status: 'RUNNING', progress: 0 })
            setIsLoading(true);

            fetch(`${API_BASE}/api/ai/train/classification/project/${project_id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                credentials: "include",
                body: JSON.stringify({
                    model_name: trainingConfig.modelName,
                    model_desc: trainingConfig.modelDesc,
                    epoch: trainingConfig.epoch,
                    batch_size: trainingConfig.batchSize,
                    learning_rate: trainingConfig.learningRate,
                    max_length: trainingConfig.maxLength,
                    shuffle: trainingConfig.shuffle,

                    data_scope: "project",
                    collection_num: projectInfo?.collection_num,
                    task_type: projectInfo?.task_type,
                    source_type: projectInfo?.source_type,
                    run_type: "train",
                    dataset: dataset
                }),
            })
                .then((res) => res.json())
                .then(() => {
                    setIsLoading(false);
                    router.push(`/project/${projectInfo.id}/models`);
                })
                .catch((err) => {
                    console.error("학습 요청 실패:", err);
                    setState({ isBusy: false, status: 'AVAILABLE' })
                    setIsLoading(false);
                    alert("학습 시작 실패");
                });
        }
    }, [dataSummary, trainingConfig, projectInfo]);

    const handleTrainingDataUpdate = useCallback((updater: any[] | ((prev: any[]) => any[]), sourceInfo?: any) => {
        console.log("함수가 호출되었습니다!");
        console.log("받은 데이터(updater):", updater);
        console.log("받은 정보(sourceInfo):", sourceInfo);

        setTrainingDataItems((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return [...next]; // 🚀 무조건 새 배열로 복사하여 자식에게 전파
        });

        if (sourceInfo && typeof sourceInfo.isCounterUsed === 'boolean') {
            console.log(">>>>>>>>>>>>>", sourceInfo.isCounterUsed)
            setIsCounterUsed(sourceInfo.isCounterUsed);
        }
    }, []);

    const handleCounterDataUpdate = useCallback((updater: any[] | ((prev: any[]) => any[])) => {
        setCounterDataItems((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            return [...next];
        });
    }, []);

    console.log("학습 데이터:", trainingDataItems)
    console.log("Count 데이터:", counterDataItems)

    // ----------------------------------------------------
    // 현재 단계 렌더링
    // ----------------------------------------------------
    const { title, content, canProceed, nextButtonText } = useMemo(() => {
        if (!projectInfo || isLoading) {
            return {
                title: "로딩 중...",
                content: <div className="text-center p-10">프로젝트 데이터를 불러오는 중입니다...</div>,
                canProceed: false, nextButtonText: "다음"
            };
        }

        const isFinalStep = currentStep === MAX_STEP;
        let contentToRender;
        let stepCanProceed = false;
        let stepTitle = "";
        let buttonText = isFinalStep ? "학습 시작하기" : "다음";

        switch (currentStep) {
            case Step.DATA_SELECTION:
                stepTitle = "데이터 선택";
                stepCanProceed = !!dataSummary && dataSummary.isValid;
                contentToRender = <Step1Content
                    token={token ?? ""}
                    modelInfo={modelInfo}
                    collectionInfo={collectionInfo}
                    projectInfo={projectInfo}
                    dataSummary={dataSummary}
                    onSelect={handleStep1Select}
                    // onNext={goToNextStep}
                    onNext={handleStep1Next}
                    canProceed={stepCanProceed}
                    projectDataGroups={projectDataGroups}
                    // ProjectGroupItems={projectDataGroups.groups}
                    totalCount={totalCount}
                    perPage={limit}
                    currentPage={page}
                    onPageChange={setPage}
                    // onTrainingDataSelect={setTrainingDataItems}
                    trainingDataItems={trainingDataItems}
                    counterDataItems={counterDataItems}
                    onRefreshCollections={async () => {
                        // 기존에 정의된 loadProjectDataGroup 함수를 호출
                        // (함수 내부에 setCollectionInfo가 있으므로 화면이 갱신됩니다)
                        await loadProjectDataGroup();
                    }}
                    onTrainingDataUpdate={handleTrainingDataUpdate}
                    onCounterDataUpdate={handleCounterDataUpdate}
                    isEditMode={isCollectionEditMode}
                    setIsEditMode={setIsCollectionEditMode}
                />;
                break;
            case Step.TRAINING_CONFIG:
                stepTitle = "학습 파라미터 설정";
                stepCanProceed = !!trainingConfig && trainingConfig.epoch >= 1;
                contentToRender = dataSummary ? <Step2Content
                    dataSummary={dataSummary}
                    onConfigChange={handleStep2ConfigChange}
                    onNext={goToNextStep}
                    onBack={goToPreviousStep}
                    canProceed={stepCanProceed}
                /> : null;
                break;
            case Step.REVIEW_AND_START:
                stepTitle = "최종 검토 및 시작";
                stepCanProceed = !!dataSummary && !!trainingConfig;
                contentToRender = dataSummary && trainingConfig ? <Step3Content
                    dataSummary={dataSummary}
                    config={trainingConfig}
                    onStart={handleStartTraining}
                    onBack={goToPreviousStep}
                    canProceed={stepCanProceed}
                /> : null;
                break;
            default:
                stepTitle = "오류";
                stepCanProceed = false;
                contentToRender = <p>잘못된 단계입니다.</p>;
        }

        return {
            title: stepTitle,
            content: contentToRender,
            canProceed: stepCanProceed,
            nextButtonText: buttonText
        };
    }, [currentStep, projectInfo, isLoading, dataSummary, trainingConfig,
        handleStep1Select, handleStep2ConfigChange, goToNextStep, goToPreviousStep,
        handleStartTraining, isCollectionEditMode, trainingDataItems, counterDataItems, modelInfo]);

    if (!projectInfo) {
        return (
            <ProjectLayout>
                <div className="text-center p-10">프로젝트 데이터를 불러오는 중입니다...</div>
            </ProjectLayout>
        );
    }

    // 프로젝트 정보가 로드된 후
    const project = projectInfo;
    const isFinalStep = currentStep === MAX_STEP;
    const nextButtonColor = isFinalStep ? "bg-green-600 hover:bg-green-700" : "bg-indigo-600 hover:bg-indigo-700";

    return (
        <ProjectLayout
            projectNo={projectInfo?.id}
            projectName={projectInfo?.project_name}
            projectDesc={projectInfo?.project_description}
            taskType={projectInfo?.task_type}
            sourceType={projectInfo?.source_type}
            collectionNum={projectInfo?.collection_num}
            CreatedDatetime={projectInfo?.created_datetime}
            UpdatedDatetime={projectInfo?.updated_datetime}
        >
            <div className="min-h-screen bg-white p-8">

                {/* 페이지 헤더 */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                    <h1 className="text-3xl font-bold text-zinc-900">학습 설정</h1>
                </div>
                <p className="text-zinc-600 ml-4">
                    데이터를 수집하고 모델 학습 파라미터를 설정하세요
                </p>
                <div className="mt-10">
                    <div className="min-h-[calc(100vh-80px)] bg-white lg:bg-gray-50 rounded-xl lg:shadow-none shadow-2xl">

                        {/* 메인 컨테이너: 데스크톱 (lg:)에서는 2단 그리드, 모바일에서는 단일 컬럼 */}
                        <div className="lg:flex lg:min-h-[calc(100vh-80px)]">

                            {/* 1. 좌측 진행 단계 사이드바 (데스크톱에서는 항상 보임, 모바일에서는 상단에 작게) */}
                            <StepSidebar
                                currentStep={currentStep}
                                setCurrentStep={setCurrentStep}
                                totalSteps={MAX_STEP}
                            />

                            {/* 2. 우측 진행 콘텐츠 영역 */}
                            <div className="lg:w-3/4 w-full p-4 sm:p-6 lg:p-10 bg-white rounded-r-xl">

                                {/* 헤더 (이미지 참고: '추가할 사업체 정보를 입력하세요' 부분) */}
                                <div className="border-b pb-4 mb-6 flex justify-between items-center">
                                    <h2 className="text-3xl font-extrabold text-gray-900">{title}</h2>
                                    {/* 데스크톱에서는 닫기 버튼 대신 단계 전환 버튼을 하단에 배치할 수 있습니다. */}
                                </div>

                                {/* 현재 단계의 실제 콘텐츠 */}
                                <div className="mb-10">
                                    {content}
                                </div>

                                {/* 데스크톱용 네비게이션 버튼 (모바일에서는 각 Step Content에서 처리) */}
                                <div className="hidden lg:flex justify-end pt-4 border-t mt-auto">
                                    <button
                                        onClick={goToPreviousStep}
                                        disabled={currentStep === 1}
                                        className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mr-3"
                                    >
                                        ← 이전
                                    </button>
                                    <button
                                        // onClick={isFinalStep ? handleStartTraining : goToNextStep}
                                        onClick={
                                            currentStep === Step.DATA_SELECTION
                                                ? handleStep1Next   // Step1일 때만 실행
                                                : isFinalStep
                                                    ? handleStartTraining
                                                    : goToNextStep
                                        }
                                        disabled={!canProceed}
                                        className={`px-6 py-2 text-white font-bold rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${nextButtonColor}`}
                                    >
                                        {nextButtonText}
                                    </button>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>

            </div>

        </ProjectLayout >
    );
}