import React, { useState } from 'react';
import { Database, Plus, ChevronRight, Calendar, Layers, Package, X } from 'lucide-react';
import GroupDataViewer from './GroupDataViewer'; // 경로는 실제 파일 위치에 맞게 수정하세요

interface DataGroupInfo {
    group_code: string;
    group_name?: string;
    count: number;
    last_updated?: string;
}

interface ExistingDataSummary {
    total_count: number;
    group_count: number;
    groups: DataGroupInfo[];
    last_updated: string;
}

interface DataSourceSelectorProps {
    hasExistingData: boolean;
    existingDataSummary: ExistingDataSummary | null;
    onSelectExisting: (groups?: any) => void;
    onSelectNew: () => void;
    projectId: string | string[];
    token: string | undefined;
}

export default function DataSourceSelector({
    hasExistingData,
    existingDataSummary,
    onSelectExisting,
    onSelectNew,
    projectId,
    token,
}: DataSourceSelectorProps) {
    // 그룹 목록 뷰의 표시 상태 관리
    const [showGroupViewer, setShowGroupViewer] = useState(false);

    // 기존 데이터 사용 버튼 클릭 핸들러
    const handleExistingClick = () => {
        // 기존 데이터 버튼이 클릭될 때 애니메이션 강조를 위해 뷰어를 열고 버튼을 닫습니다.
        setShowGroupViewer(true);
    };

    // GroupDataViewer에서 그룹 선택이 완료되었을 때의 핸들러
    const handleGroupSelectionComplete = (selectedGroups: DataGroupInfo[]) => {
        // 선택된 그룹 정보를 상위 컴포넌트로 전달
        onSelectExisting(selectedGroups);
        // Group Viewer 닫기
        setShowGroupViewer(false);
        // onSelectExisting에서 다음 단계로 이동하는 로직이 처리된다고 가정
    };

    // 기존 데이터 사용 버튼의 조건부 스타일 (뷰어가 닫혀있을 때)
    const existingButtonClass = `
        w-full bg-white rounded-2xl shadow-lg border-2 p-6 text-left group
        transition-all duration-300 ease-in-out transform
        ${showGroupViewer
            ? 'opacity-50 border-zinc-200 pointer-events-none' // 뷰어가 열려있을 때 희미하게 처리
            : 'border-zinc-200 hover:border-emerald-500 hover:shadow-xl active:scale-[0.99]' // 기본/호버/클릭 효과
        }
    `;

    // 새 데이터 추가 버튼의 조건부 스타일
    const newButtonClass = `
        w-full bg-white rounded-2xl shadow-lg border-2 p-6 text-left group
        transition-all duration-300 ease-in-out transform
        ${showGroupViewer
            ? 'opacity-50 border-zinc-200 pointer-events-none' // 뷰어가 열려있을 때 희미하게 처리
            : 'border-zinc-200 hover:border-blue-500 hover:shadow-xl active:scale-[0.99]' // 기본/호버/클릭 효과
        }
    `;

    // 뷰어가 활성화되었을 때의 스타일
    const viewerBoxClass = `
        relative p-6 rounded-2xl shadow-xl transition-all duration-300 ease-in-out
        ${showGroupViewer
            ? 'border-4 border-emerald-500 bg-emerald-50/70' // 활성 메뉴 강조 (더 두꺼운 경계선, 밝은 배경)
            : 'border-2 border-zinc-200' // 비활성 상태 (이 컴포넌트에서는 뷰어가 닫히면 렌더링되지 않으므로 사실상 사용 안 됨)
        }
    `;

    return (
        <div className="space-y-4">
            {/* 기존 데이터 사용 옵션 */}
            {/* 1. 기존 데이터 사용 옵션 버튼 */}
            {/* 1. 기존 데이터 사용 옵션 (버튼 or 그룹 뷰어) */}
            {hasExistingData && existingDataSummary && (
                <>
                    {/* 그룹 뷰어가 닫혀있을 때 (버튼 표시) */}
                    {!showGroupViewer ? (
                        <button
                            onClick={handleExistingClick} // 버튼 클릭 시 뷰어 열기
                            className={existingButtonClass}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                                            <Database className="w-6 h-6 text-white" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-zinc-900">
                                                기존 데이터 사용 (그룹 목록 보기)
                                            </h3>
                                            <p className="text-sm text-zinc-500">
                                                이미 추가된 데이터 그룹 목록을 확인하고 학습 시작
                                            </p>
                                        </div>
                                    </div>
                                    {/* 요약 정보 */}
                                    <div className="ml-[60px] space-y-2">
                                        <div className="flex items-center gap-2 text-sm text-zinc-600">
                                            <Package className="w-4 h-4 text-emerald-600" />
                                            <span>
                                                <strong className="text-zinc-900">
                                                    {existingDataSummary.total_count.toLocaleString()}개
                                                </strong>{' '}
                                                항목
                                            </span>
                                            <span className="text-zinc-400">•</span>
                                            <span>
                                                <strong className="text-zinc-900">
                                                    {existingDataSummary.group_count}개
                                                </strong>{' '}
                                                그룹
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all duration-300" />
                            </div>
                        </button>
                    ) : (
                        // 그룹 뷰어가 열려있을 때 (강조된 박스 렌더링)
                        <div className={viewerBoxClass}>
                            <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                ✅ 기존 데이터 그룹 선택
                            </h3>
                            <GroupDataViewer
                                projectId={projectId}
                                token={token}
                                onGroupsSelected={handleGroupSelectionComplete}
                                onCancel={() => setShowGroupViewer(false)}
                            />
                        </div>
                    )}
                </>
            )}



            {/* 2. 그룹 데이터 뷰어 (showGroupViewer 상태일 때 렌더링) */}
            {/* {hasExistingData && showGroupViewer && (
                <div className="relative p-6 border-2 border-emerald-300 rounded-2xl shadow-xl bg-emerald-50/50">
                    <h3 className="text-lg font-bold text-emerald-800 mb-4">
                        ✅ 기존 데이터 그룹 선택
                    </h3>
                    <GroupDataViewer
                        projectId={projectId}
                        token={token}
                        onGroupsSelected={handleGroupSelectionComplete} // 선택 완료 핸들러
                        onCancel={() => setShowGroupViewer(false)} // 취소 핸들러
                    />
                </div>
            )} */}

            {/* 2. 그룹 뷰어가 닫혀있거나 기존 데이터가 없을 때 표시되는 옵션 버튼들 */}
            {/* 기존 데이터 사용 옵션 버튼 */}
            {/* {hasExistingData && existingDataSummary && !showGroupViewer && (
                <button
                    onClick={() => setShowGroupViewer(true)} // 버튼 클릭 시 뷰어 열기
                    className="w-full bg-white rounded-2xl shadow-lg border-2 border-zinc-200 hover:border-emerald-500 hover:shadow-xl transition-all p-6 text-left group"
                >
                </button>
            )} */}

            {/* 3. 새 데이터 추가 옵션 */}
            {/* 2. 새 데이터 추가 옵션 */}
            <button
                onClick={onSelectNew}
                className={newButtonClass}
                disabled={showGroupViewer} // 뷰어가 열려있을 때 비활성화
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-zinc-900">
                                    새로운 데이터 추가
                                </h3>
                                <p className="text-sm text-zinc-500">
                                    {hasExistingData ? '추가 데이터를 수집하여 학습' : '데이터를 수집하여 학습 시작'}
                                </p>
                            </div>
                        </div>

                        <div className="ml-[60px] text-sm text-zinc-600">
                            검색 또는 파일 업로드를 통해 데이터 추가
                        </div>
                    </div>

                    <ChevronRight className="w-6 h-6 text-zinc-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
                </div>
            </button>
        </div>
    );
}