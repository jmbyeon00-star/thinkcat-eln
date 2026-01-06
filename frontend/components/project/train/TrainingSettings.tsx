// frontend/components/project/train/TrainingSetting.tsx

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronUp, ChevronDown, ChevronRight, CheckCircle, Database, Settings, Play, Upload, FileText, XCircle } from 'lucide-react';
import { ProjectData, ProjectInfo, ProjectDataGroups, DataSummary, TrainingConfig, DataSourceInfo } from "@/types/project";
import { CollectionInfo } from "@/types/collection";
import { ProjectGroupItems } from "@/types/project";
import { setDatetimeToDate } from "@/utils/common";
import SearchComponent from "../SearchComponent";
import UploadComponent from "../UploadComponent";

// Step Enum 정의 (메인 파일과 동일하게 유지)
export enum Step {
    DATA_SELECTION = 1,
    TRAINING_CONFIG = 2,
    REVIEW_AND_START = 3,
}
export const MAX_STEP = 3;

// ----------------------------------------------------
// 1. 좌측 사이드바 (Step Sidebar) 컴포넌트
// ----------------------------------------------------
interface StepSidebarProps {
    currentStep: Step;
    setCurrentStep: (step: Step) => void;
    totalSteps: number;
}

export const StepSidebar: React.FC<StepSidebarProps> = ({ currentStep, setCurrentStep, totalSteps }) => {
    const steps = [
        { id: Step.DATA_SELECTION, name: "데이터 선택", icon: Database },
        { id: Step.TRAINING_CONFIG, name: "학습 설정", icon: Settings },
        { id: Step.REVIEW_AND_START, name: "검토 및 시작", icon: Play },
    ];

    const progress = Math.round(((currentStep - 1) / (totalSteps - 1)) * 100);

    return (
        <div className="lg:w-1/4 w-full bg-white lg:bg-gray-50 lg:p-0 p-4 rounded-xl lg:rounded-none lg:border-r lg:shadow-none shadow-lg mb-6 lg:mb-0">
            {/* 데스크톱 헤더 */}
            <div className="hidden lg:block p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">새 학습 작업 설정</h2>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
                    <div
                        className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* 모바일 진행률 표시 */}
            <div className="lg:hidden w-full mb-4">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Step {currentStep}/{totalSteps}: {steps.find(s => s.id === currentStep)?.name}</h3>
                <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* 단계 목록 */}
            <ol className="space-y-1 lg:space-y-2 p-0 lg:p-6">
                {steps.map((step) => {
                    const isCurrent = step.id === currentStep;
                    const isCompleted = step.id < currentStep;
                    const isClickable = step.id <= currentStep;

                    return (
                        <li key={step.id}>
                            <button
                                onClick={() => isClickable && setCurrentStep(step.id)}
                                disabled={!isClickable}
                                className={`flex items-center w-full py-2 px-3 rounded-lg text-left transition-colors font-medium ${isCurrent
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : isCompleted
                                        ? 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-600'
                                        : 'text-gray-400 cursor-default'
                                    }`}
                            >
                                <span className={`text-sm mr-3 font-bold ${isCurrent ? 'text-white' : isCompleted ? 'text-indigo-600' : 'text-gray-400'}`}>
                                    {step.id}
                                </span>
                                <span className={`${isCurrent ? 'text-white' : 'text-inherit'}`}>
                                    {step.name}
                                </span>
                                {isCompleted && (
                                    <CheckCircle className={`w-4 h-4 ml-auto ${isCurrent ? 'text-white' : 'text-indigo-600'}`} />
                                )}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </div>
    );
};


// ----------------------------------------------------
// 2. Step 1: 데이터 선택 컴포넌트
// ----------------------------------------------------
export const Step1Content: React.FC<{
    collectionInfo: CollectionInfo[],
    projectInfo: ProjectInfo,
    token: string;
    dataSummary: DataSummary | null;
    onSelect: (data: DataSummary) => void,
    onNext: () => void,
    canProceed: boolean,
    projectDataGroups: ProjectDataGroups | null;
    totalCount: number,
    perPage: number,
    currentPage: number,
    onPageChange: (page: number) => void,
    // onTrainingDataUpdate: (data: ProjectData) => void,
    // onCounterDataUpdate: (data: ProjectData) => void
    onTrainingDataUpdate: (updater: ProjectData[] | ((prev: ProjectData[]) => ProjectData[])) => void,
    onCounterDataUpdate: (updater: ProjectData[] | ((prev: ProjectData[]) => ProjectData[])) => void
}> = ({
    collectionInfo, projectInfo, token, dataSummary, onSelect, onNext, canProceed, projectDataGroups, totalCount, perPage, currentPage, onPageChange, onTrainingDataUpdate, onCounterDataUpdate
}) => {
        useEffect(() => {
            console.log("deleted!")
            // "데이터 선택" 단계로 들어오면 부모가 가진 상태들을 즉시 비움
            onSelect({ totalItemsCount: 0, isValid: false, sourceList: [] });
            onTrainingDataUpdate([]);
            onCounterDataUpdate([]);

            console.log("Step 1 진입: 부모 데이터가 초기화되었습니다.");
        }, []); // 의존성 배열을 비워 마운트 시 1회만 실행
        // --------------------
        // 통합 관리
        // --------------------
        const [selectedSources, setSelectedSources] = useState<DataSourceInfo[]>([]);

        const calculatedSummary: DataSummary = useMemo(() => {
            const totalItemsCount = selectedSources.reduce((sum, source) => sum + source.count, 0);
            const isValid = totalItemsCount > 0;

            return {
                totalItemsCount: totalItemsCount,
                isValid: isValid,
                sourceList: selectedSources,
            };
        }, [selectedSources]);

        useEffect(() => {
            onSelect(calculatedSummary);
        }, [calculatedSummary, onSelect]);

        const handleTrainingDataAddition = useCallback((
            newItems: any[],
            sourceInfo: DataSourceInfo
        ) => {
            onTrainingDataUpdate((prevItems: ProjectData[]) => [...prevItems, ...newItems]);

            setSelectedSources(prevSources => {
                const isDuplicate = prevSources.some(
                    s => s.type === sourceInfo.type && s.name === sourceInfo.name
                );
                if (isDuplicate) return prevSources;

                return [...prevSources, sourceInfo];
            });

        }, [onTrainingDataUpdate]);

        const handleCounterDataAddition = useCallback((
            newItems: any[],
        ) => {
            onCounterDataUpdate((prevItems: ProjectData[]) => [...prevItems, ...newItems]);
        }, [onTrainingDataUpdate, onCounterDataUpdate]);

        // --------------------
        // 새로운 데이터 추가
        // --------------------
        const [uploadedFile, setUploadedFile] = useState<File | null>(null);
        const [isNewOpen, setIsNewOpen] = useState(false);
        const handleNewOpen = (open: boolean) => {
            setIsNewOpen(open);
            if (open) setIsExistingOpen(false);
        };


        // --------------------
        // 기존 데이터 선택
        // --------------------
        const [isExistingOpen, setIsExistingOpen] = useState(false);
        const handleExistingOpen = (open: boolean) => {
            setIsExistingOpen(open);
            if (open) setIsNewOpen(false);
        };
        const [selectedGroups, setSelectedGroups] = useState<number[]>([]);
        const handleGroupToggle = useCallback((group: ProjectGroupItems) => {
            const groupId = group.id;
            const groupItems = group.group_items;
            const isCurrentlySelected = selectedGroups.includes(groupId);

            // 1. UI 상태 업데이트 (체크박스)
            setSelectedGroups(prevSelected =>
                isCurrentlySelected
                    ? prevSelected.filter(id => id !== groupId)
                    : [...prevSelected, groupId]
            );

            // 2. 데이터 아이템 분기 처리
            if (isCurrentlySelected) {
                // 선택 해제 시: 해당 그룹의 모든 아이템을 양쪽에서 제거
                const itemIdsToRemove = new Set(groupItems.map(item => item.id));
                onTrainingDataUpdate(prev => prev.filter(item => !itemIdsToRemove.has(item.id)));
                onCounterDataUpdate(prev => prev.filter(item => !itemIdsToRemove.has(item.id)));
            } else {
                // 선택 시: used 속성에 따라 학습용(1)과 대조군(0)으로 분류
                // 파일 업로드 데이터는 used가 1이므로 trainingItems로만 들어감
                const trainingItems = groupItems.filter(item => item.used === 1 || item.used === true);
                const counterItems = groupItems.filter(item => item.used === 0 || item.used === false);

                onTrainingDataUpdate(prev => [...prev, ...trainingItems]);
                onCounterDataUpdate(prev => [...prev, ...counterItems]);
            }

            // 3. 소스 요약 정보(DataSummary용) 업데이트
            const sourceInfo: DataSourceInfo = {
                name: group.group_code,
                count: group.count,
                type: 'group',
                sourceId: groupId,
            };

            setSelectedSources(prevSources =>
                isCurrentlySelected
                    ? prevSources.filter(s => !(s.type === 'group' && s.sourceId === groupId))
                    : [...prevSources, sourceInfo]
            );
        }, [selectedGroups, onTrainingDataUpdate, onCounterDataUpdate]);

        // --------------------
        // 페이지네이션
        // --------------------
        const totalPages = Math.ceil(totalCount / perPage);
        const handlePageChange = (page: number) => {
            if (page >= 1 && page <= totalPages) {
                onPageChange(page);
            }
        };

        // ----------------------------------------------------
        // 아코디언 공통 UI 컴포넌트 (동일)
        // ----------------------------------------------------
        const AccordionItem: React.FC<{
            title: string; description: string; children: React.ReactNode;
            isOpen: boolean; setIsOpen: (open: boolean) => void;
            isUsed: boolean; setIsUsed: (used: boolean) => void;
        }> = ({ title, description, children, isOpen, setIsOpen, isUsed, setIsUsed }) => (
            <div className="border border-gray-200 rounded-lg shadow-sm">
                <div
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${isUsed ? 'bg-indigo-50 hover:bg-indigo-100' : 'bg-white hover:bg-gray-50'}`}
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <div className="flex items-center">
                        <div>
                            <h4 className={`text-lg font-bold ${isUsed ? 'text-indigo-800' : 'text-gray-800'}`}>{title}</h4>
                            <p className="text-sm text-gray-500">{description}</p>
                        </div>
                    </div>
                    {isOpen ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                </div>
                {isOpen && (<div className="p-4 border-t border-gray-200 bg-white">{children}</div>)}
            </div>
        );

        // if (!projectDataGroups && projectDataGroups.groups.length === 0) {
        if (!projectDataGroups || (projectDataGroups && projectDataGroups.groups.length === 0)) {
            return (
                <div className="text-center p-10 text-gray-500">
                    <Database className="w-8 h-8 mx-auto mb-3 animate-pulse" />
                    <p>프로젝트 데이터 그룹을 불러오는 중이거나 데이터가 없습니다.</p>
                </div>
            );
        }
        // ----------------
        // 데이터 현황 관리
        // ----------------
        const typeLabelMap: Record<string, string> = {
            group: "📦 그룹 데이터",
            upload: "📁 업로드 파일",
            search: "🔍 DB 검색 데이터",
        };
        const groupedSources = useMemo(() => {
            return calculatedSummary.sourceList.reduce((acc, item) => {
                if (!acc[item.type]) acc[item.type] = [];
                acc[item.type].push(item);
                return acc;
            }, {} as Record<string, DataSourceInfo[]>);
        }, [calculatedSummary.sourceList]);

        const handleRemoveSource = (source: DataSourceInfo) => {
            // 1. 선택된 소스 목록에서 제거
            setSelectedSources(prev => prev.filter(s => !(s.type === source.type && s.sourceId === source.sourceId)));

            // 2. 그룹 타입일 경우 selectedGroups에서도 제거
            if (source.type === "group") {
                setSelectedGroups(prev => prev.filter(id => id !== source.sourceId));
            }

            // 3. TrainingDataItems에서도 제거
            onTrainingDataUpdate(prev => {
                // 그룹 데이터 삭제
                if (source.type === "group") {
                    const group = projectDataGroups.groups.find(g => g.id === source.sourceId);
                    if (!group) return prev;

                    const removeIds = new Set(group.group_items.map(item => item.id));
                    return prev.filter(item => !removeIds.has(item.id));
                }

                // 업로드 / 검색 데이터 삭제
                return prev.filter(item => item.sourceId !== source.sourceId);
            });
            onCounterDataUpdate(prev => {
                // 그룹 데이터 삭제
                if (source.type === "group") {
                    const group = projectDataGroups.groups.find(g => g.id === source.sourceId);
                    if (!group) return prev;

                    const removeIds = new Set(group.group_items.map(item => item.id));
                    return prev.filter(item => !removeIds.has(item.id));
                }

                // 업로드 / 검색 데이터 삭제
                return prev.filter(item => item.sourceId !== source.sourceId);
            });

            // if (source.type === "group") {
            //     // 3-1. 기존 (그룹) 데이터 제거
            //     const group = projectDataGroups.groups.find(g => g.id === source.sourceId);

            //     if (group) {
            //         const removeIds = new Set(group.group_items.map(item => item.id));
            //         onTrainingDataUpdate(prev => prev.filter(item => !removeIds.has(item.id)));
            //     }

            // } else {
            //     // 3-2. 파일 업로드 & DB 검색 데이터 삭제
            //     onTrainingDataUpdate(prev => prev.filter(item => item.id !== source.sourceId));
            // }
        };

        const hasSearchOrUpload =
            dataSummary?.sourceList?.some(src => src.type === "search" || src.type === "upload") ?? false;

        const handleRemoveFile = useCallback(() => {
            if (uploadedFile) {
                // 1. uploadedFile 상태 초기화
                setUploadedFile(null);

                // 2. selectedSources에서도 해당 업로드 소스 제거 (파일 이름 기준)
                setSelectedSources(prev => prev.filter(
                    s => !(s.type === 'upload' && s.name === uploadedFile.name)
                ));

                // 3. onTrainingDataUpdate를 통해 TrainingDataItems에서도 제거하는 로직이 필요할 수 있습니다.
                // (현재는 타입 오류 해결을 위해 1, 2만 진행)
            }
        }, [uploadedFile]); // uploadedFile이 변경될 때만 재생성


        return (
            <div className="space-y-6">
                <h3 className="text-xl font-semibold text-gray-800">데이터 소스 관리</h3>
                <p className="text-gray-500">학습에 사용할 데이터를 선택하고, 필요하다면 여러 소스를 병합하여 사용하세요.</p>

                <div className="space-y-4">
                    {/* ---------------------------------------------------- */}
                    {/* 1. 📦 기존 프로젝트 데이터 그룹 아코디언 */}
                    {/* ---------------------------------------------------- */}
                    <AccordionItem
                        title="📦 기존 프로젝트 데이터 그룹"
                        description={`총 ${totalCount}개 그룹을 선택할 수 있습니다. (${projectInfo.labeled_documents}개 항목)`}
                        isOpen={isExistingOpen}
                        // setIsOpen={setIsExistingOpen}
                        setIsOpen={handleExistingOpen}
                        isUsed={selectedGroups.length > 0}
                        // 📌 [FIX] 상위 체크박스 로직: 전체 선택/해제 기능만 수행 (개별 선택 기능과 분리)
                        setIsUsed={(used) => {
                            if (used && projectDataGroups.groups.length > 0) {
                                setSelectedGroups(projectDataGroups.groups.map(group => group.id));
                            } else {
                                setSelectedGroups([]);
                            }
                        }}
                    >
                        <>
                            <div className="space-y-2">
                                {projectDataGroups && projectDataGroups.groups && projectDataGroups.groups.length > 0 ?
                                    (
                                        projectDataGroups.groups.map(group => {
                                            // const globalIndex = (currentPage - 1) * perPage + group.id
                                            const isSelected = selectedGroups.includes(group.id);
                                            return (
                                                <div
                                                    key={group.id}
                                                    className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-colors ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
                                                    onClick={() => handleGroupToggle(group)}
                                                >
                                                    <div className="flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            readOnly
                                                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                                                        />
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-800"></p>
                                                            <p className="text-xs text-gray-500">{group.id} | {group.group_code}</p>
                                                        </div>
                                                    </div>
                                                    {isSelected && <CheckCircle className="w-4 h-4 text-indigo-600" />}
                                                </div>


                                            );
                                        })
                                    ) : (
                                        // 데이터가 없을 경우 표시되는 영역
                                        <div className="text-center p-6 bg-gray-50 rounded-lg border border-gray-200">
                                            <Database className="w-6 h-6 mx-auto mb-2 text-gray-400" />
                                            <p className="text-sm text-gray-600 font-medium">현재 프로젝트에 등록된 기존 데이터 그룹이 없습니다.</p>
                                        </div>
                                    )}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200">
                                    <button
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 text-sm font-medium text-indigo-600 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        이전
                                    </button>

                                    <span className="text-sm text-gray-700">
                                        페이지 <span className="font-bold text-gray-900">{currentPage}</span> / <span className="font-bold text-gray-900">{totalPages}</span>
                                    </span>

                                    <button
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 text-sm font-medium text-indigo-600 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                    >
                                        다음
                                    </button>
                                </div>
                            )}
                        </>
                    </AccordionItem>

                    {/* ---------------------------------------------------- */}
                    {/* 2. ➕ 새로운 데이터 추가/검색 아코디언 */}
                    {/* ---------------------------------------------------- */}
                    <AccordionItem
                        title="➕ 새로운 데이터 추가/병합"
                        description={uploadedFile ? `업로드 대기 중: ${uploadedFile.name}` : "XLSX, CSV, JSON 파일 업로드 또는 DB 검색 결과 추가"}
                        isOpen={isNewOpen}
                        // setIsOpen={setIsNewOpen}
                        setIsOpen={handleNewOpen}
                        // isUsed={uploadedFile !== null}
                        isUsed={hasSearchOrUpload}
                        setIsUsed={(used) => { if (!used) handleRemoveFile(); }}
                    >
                        <div className="space-y-4">
                            {
                                projectInfo.source_type == "search" &&
                                <SearchComponent
                                    project={projectInfo}
                                    token={token}
                                    collections={collectionInfo}
                                    // onTrainingDataUpdate={onTrainingDataUpdate}
                                    onTrainingDataUpdate={handleTrainingDataAddition}
                                    onCounterDataUpdate={handleCounterDataAddition}
                                />
                            }
                            {
                                projectInfo.source_type == "upload" &&
                                <UploadComponent
                                    project={projectInfo}
                                    token={token}
                                    collections={collectionInfo}
                                    // onTrainingDataUpdate={onTrainingDataUpdate}
                                    onTrainingDataUpdate={handleTrainingDataAddition}
                                />
                            }
                        </div>
                    </AccordionItem>
                </div>

                {/* ------------------------------ */}
                {/* 선택된 데이터 요약 박스 */}
                {/* ------------------------------ */}
                <div className="p-4 border border-gray-300 rounded-lg bg-gray-50 space-y-3">
                    <h4 className="text-lg font-semibold text-gray-800">
                        현재 선택된 데이터 ({calculatedSummary.totalItemsCount}개)
                    </h4>

                    {Object.keys(groupedSources).length === 0 ? (
                        <p className="text-gray-500 text-sm">아직 선택된 데이터가 없습니다.</p>
                    ) : (
                        Object.entries(groupedSources).map(([type, items]) => (
                            <div key={type} className="bg-white p-3 rounded-md border">
                                <p className="font-semibold text-gray-700 mb-1">
                                    {typeLabelMap[type] ?? type} · {items.length}개 소스
                                </p>

                                <ul className="ml-2 space-y-1">
                                    {items.map((item, idx) => (
                                        <li
                                            key={idx}
                                            className="text-sm text-gray-700 flex justify-between items-center"
                                        >
                                            <div>
                                                • {item.name}
                                                <span className="font-semibold text-gray-900 ml-2">
                                                    ({item.count}개)
                                                </span>
                                            </div>

                                            {/* 삭제 버튼 */}
                                            <button
                                                onClick={() => handleRemoveSource(item)}
                                                className="text-red-500 hover:text-red-700 ml-3"
                                                title="삭제"
                                            >
                                                ✕
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            </div>
        );
    };


// ----------------------------------------------------
// 3. Step 2: 학습 설정 컴포넌트
// ----------------------------------------------------
export const Step2Content: React.FC<{
    dataSummary: DataSummary, onConfigChange: (config: TrainingConfig) => void, onNext: () => void, onBack: () => void, canProceed: boolean
}> = ({ dataSummary, onConfigChange, onNext, onBack, canProceed }) => {

    // TrainingConfig 타입을 사용하여 상태 정의
    const [config, setConfig] = useState<TrainingConfig>({
        modelName: '이름 없음',
        modelDesc: '설명 없음',
        epoch: 10,
        batchSize: 32,
        learningRate: 1e-5,
        maxLength: 128,
        shuffle: true,
    });

    // 설정 변경 시 즉시 상위 컴포넌트로 전달
    useEffect(() => {
        onConfigChange(config);
    }, [config, onConfigChange]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setConfig(c => ({
            ...c,
            // id가 'modelName'일 경우 문자열, 아닐 경우 숫자로 변환
            [id]: id === 'modelName' || id === 'modelDesc' ? value : (id === 'learningRate' ? parseFloat(value) : parseInt(value) || 1),
        }));
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">모델 및 파라미터 정의</h3>
            <p className="text-gray-500">학습에 사용할 모델 이름과 하이퍼파라미터를 설정하세요.</p>

            {/* 1단계 요약 */}
            <div className="bg-gray-100 p-3 rounded-lg text-sm border border-gray-200">
                <p className="font-semibold text-gray-700">
                    선택 데이터:
                    <span className="font-medium text-gray-900">
                        {dataSummary.sourceList.length}개 소스
                    </span>
                    (
                    {dataSummary.totalItemsCount}개
                    )</p>
            </div>

            {/* 설정 폼 */}
            <div className="space-y-4">
                <div>
                    <label htmlFor="modelName" className="block text-sm font-medium text-gray-700">모델 이름</label>
                    <input
                        id="modelName"
                        type="text"
                        value={config.modelName}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label htmlFor="modelDesc" className="block text-sm font-medium text-gray-700">모델 설명</label>
                    <input
                        id="modelDesc"
                        type="text"
                        value={config.modelDesc}
                        onChange={handleInputChange}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="epoch" className="block text-sm font-medium text-gray-700">학습 횟수(Epoch)</label>
                    <input
                        id="epoch"
                        type="number"
                        min="1"
                        value={config.epoch}
                        onChange={handleInputChange}
                        className="mt-1 block w-1/3 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="batchSize" className="block text-sm font-medium text-gray-700">배치 크기(Batch Size)</label>
                    <input
                        id="batchSize"
                        type="number"
                        min="1"
                        value={config.batchSize}
                        onChange={handleInputChange}
                        className="mt-1 block w-1/3 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="learningRate" className="block text-sm font-medium text-gray-700">학습률(Learning Rate)</label>
                    <input
                        id="learningRate"
                        type="number"
                        step="any" // 소수점 입력 허용
                        value={config.learningRate}
                        onChange={handleInputChange}
                        className="mt-1 block w-1/3 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label htmlFor="learningRate" className="block text-sm font-medium text-gray-700">최대 길이(Max Length)</label>
                    <input
                        id="maxLength"
                        type="number"
                        step="any" // 소수점 입력 허용
                        value={config.maxLength}
                        onChange={handleInputChange}
                        className="mt-1 block w-1/3 border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">데이터 섞기(Shuffle)</label>
                    <button
                        type="button"
                        onClick={() =>
                            setConfig(c => ({ ...c, shuffle: !c.shuffle }))
                        }
                        className={`
                            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                            ${config.shuffle ? "bg-indigo-600" : "bg-gray-300"}
                        `}
                    >
                        <span
                            className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                                ${config.shuffle ? "translate-x-6" : "translate-x-1"}
                            `}
                        />
                    </button>
                </div>
            </div>

            {/* 모바일용 버튼 */}
            <div className="lg:hidden pt-6 border-t flex justify-between">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                >
                    ← 이전
                </button>
                <button
                    onClick={onNext}
                    disabled={!canProceed}
                    className={`px-6 py-2 text-white font-bold rounded-lg shadow-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700`}
                >
                    다음 →
                </button>
            </div>
        </div>
    );
};


// ----------------------------------------------------
// 4. Step 3: 검토 및 시작 컴포넌트
// ----------------------------------------------------
export const Step3Content: React.FC<{ dataSummary: DataSummary, config: TrainingConfig, onStart: () => void, onBack: () => void, canProceed: boolean }> = ({ dataSummary, config, onStart, onBack, canProceed }) => {
    const typeLabelMap: Record<string, string> = {
        group: "그룹 데이터",
        upload: "파일 데이터",
        search: "DB 데이터",
    };

    const groupedSources = useMemo(() => {
        return dataSummary.sourceList.reduce((acc, item) => {
            // console.log("acc:", acc, "item:", item)
            if (!acc[item.type]) acc[item.type] = [];
            acc[item.type].push(item);
            return acc;
        }, {} as Record<string, DataSourceInfo[]>);
    }, [dataSummary.sourceList]);

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-semibold text-gray-800">최종 설정 검토</h3>
            <p className="text-gray-500">모든 설정을 확인한 후 학습을 시작해 주세요.</p>

            <div className="space-y-4">
                {/* 데이터 요약 */}
                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                    <h4 className="font-bold text-lg text-indigo-700 mb-2">데이터 설정</h4>
                    <div className="ml-2 space-y-1 text-sm text-indigo-800">
                        <p>{dataSummary.totalItemsCount}개</p>
                        <div className="space-y-4">
                            {Object.entries(groupedSources).map(([type, items]) => (
                                <div key={type} className="p-3 border rounded-md bg-gray-50">
                                    <h4 className="font-semibold text-gray-800 mb-2">
                                        {typeLabelMap[type] ?? "기타 데이터"} ({items.length})
                                    </h4>

                                    <ul className="space-y-1 text-sm text-gray-700">
                                        {items.map((item, idx) => (
                                            <li key={idx} className="flex justify-between">
                                                <span>• {item.name}</span>
                                                <span>{item.count}개</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 설정 요약 */}
                <div className="p-4 rounded-lg bg-green-50 border border-green-200">
                    <h4 className="font-bold text-lg text-green-700 mb-2">모델 파라미터</h4>
                    <div className="ml-2 space-y-1 text-sm text-green-800">
                        <p><b>모델 이름:</b> {config.modelName}</p>
                        <p><b>모델 설명:</b> {config.modelDesc}</p>
                        <p><b>학습 횟수(Epoch):</b> {config.epoch}</p>
                        <p><b>학습률(Learning Rate):</b> {config.learningRate}</p>
                        <p><b>배치 크기(Batch Size):</b> {config.batchSize}</p>
                        <p><b>최대 크기(Max Length):</b> {config.maxLength}</p>
                        <p><b>데이터 섞기(Shuffle):</b> {config.shuffle ? "Yes" : "No"}</p>
                    </div>
                </div>
            </div>

            {/* 모바일용 버튼 */}
            <div className="lg:hidden pt-6 border-t flex justify-between">
                <button
                    onClick={onBack}
                    className="px-6 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
                >
                    ← 이전
                </button>
                <button
                    onClick={onStart}
                    disabled={!canProceed}
                    className={`px-6 py-3 text-white font-bold rounded-lg shadow-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-green-600`}
                >
                    <Play className="w-5 h-5 mr-2 inline-block" /> 학습 시작하기
                </button>
            </div>
        </div>
    );
};