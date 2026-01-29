// frontend/pages/project/[project_id]/models/new.tsx
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import {
    PlayCircle, CheckCircle, Database, Plus, ChevronDown, ChevronRight, RotateCw,
    ChevronLeft, Zap, Layers, Sparkles, Settings, Trash2, Loader2,
    XCircle, AlertCircle, CheckCircle2, Tag, Lock, FolderPlus, Monitor, MonitorSmartphone
} from "lucide-react";
import { ProjectData, ProjectGroupItems, ProjectDataGroups, TrainingConfig } from "@/types/project";
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import ProjectTypeSection from "@/components/project/ProjectTypeSection";
import SearchComponent from "@/components/project/SearchComponent";
import UploadComponent from "@/components/project/UploadComponent";
import SmartDataTable from "@/components/project/SmartDataTable";

// ----------------------------------------------------------------
// [1] 단계 배지
// ----------------------------------------------------------------
function StepBadge({ num, label, active, done }: { num: number; label: string; active: boolean; done: boolean }) {
    return (
        <div className={`flex items-center gap-3 px-8 py-3 rounded-full border transition-all duration-300 ${active ? 'bg-blue-600 text-white shadow-md border-blue-600 scale-105' :
            done ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-zinc-200 text-zinc-400'
            }`}>
            <span className={`text-[10px] font-black ${active ? 'text-blue-200' : 'text-inherit'}`}>0{num}</span>
            <span className="text-sm font-bold tracking-tight">{label}</span>
            {done && <CheckCircle size={14} className="ml-1" />}
        </div>
    );
}

// ----------------------------------------------------------------
// [2] 1단계 워크스테이션
// ----------------------------------------------------------------
const Step1Workstation = ({
    setSavedGroupCode, hasModel, autoCollect, setAutoCollect,
    projectInfo, projectDataGroups, modelInfo, collectionInfo, setCollectionInfo,
    trainingItems, setTrainingItems, groupName, setGroupName, onNext, isLoading,
    currentPage, totalCount, perPage, onPageChange, API_BASE, token
}: any) => {
    const [openSection, setOpenSection] = useState<"groups" | "acquisition">("acquisition");
    const [activeTab, setActiveTab] = useState<"correct" | "counter">("correct");
    const [itemPage, setItemPage] = useState(1);
    const itemsPerPage = 5;

    const getUniqueKey = (item: any) => {
        const title = String(item.title || "").trim();
        const abstract = String(item.abstract || "").trim();
        const appNum = String(item.application_number || "").trim();

        if (appNum) {
            return `ID:${appNum}_T:${title}_A:${abstract}`;
        }
        return `T:${title}_A:${abstract}`;
    };

    // const requirementStats = useMemo(() => {
    //     const projectLabels = (collectionInfo || []).map((c: any) => String(c.collection_name));
    //     const uploadedLabels = trainingItems.map((i: any) => String(i.collection_name));

    //     const allNames = Array.from(new Set([
    //         ...(collectionInfo || []).map((c: any) => c.collection_name),
    //         ...trainingItems.map((i: any) => i.collection_name)
    //     ])).filter(Boolean);
    //     // const allNames = Array.from(new Set(
    //     //     trainingItems.map((i: any) => i.collection_name)
    //     // )).filter(Boolean);

    //     return allNames.map((name: any) => {

    //         const filtered = trainingItems.filter((i: any) => String(i.collection_name) === String(name));
    //         const keys = filtered.map(item => getUniqueKey(item));
    //         const uniqueKeysCount = new Set(keys).size;
    //         const duplicateCount = filtered.length - uniqueKeysCount;

    //         const correctCount = filtered.filter((i: any) => Number(i.used) === 1).length;
    //         const counterCount = filtered.filter((i: any) => Number(i.used) === 0).length;

    //         const correctOk = correctCount >= 10;
    //         const counterOk = autoCollect ? (counterCount >= 10) : true;

    //         return {
    //             name,
    //             correct: { count: correctCount, isOk: correctOk, percent: Math.min((correctCount / 10) * 100, 100) },
    //             counter: { count: counterCount, isOk: counterCount >= 10, percent: Math.min((counterCount / 10) * 100, 100) },
    //             duplicateCount,
    //             isAllOk: correctOk && counterOk // 최종 통과 여부
    //         };
    //     });
    // }, [trainingItems, autoCollect, collectionInfo]);
    // // }, [trainingItems, autoCollect]);
    const requirementStats = useMemo(() => {
        const projectLabels = (collectionInfo || []).map((c: any) => String(c.collection_name));// 1. 기존 프로젝트 레이블 목록
        const currentItemsLabels = Array.from(new Set(trainingItems.map((i: any) => String(i.collection_name))));// 2. 현재 데이터에 포함된 레이블 목록
        const allNames = Array.from(new Set([...projectLabels, ...currentItemsLabels])).filter(Boolean);// 전체 레이블 합집합

        const allCorrectKeys = new Set(
            trainingItems
                .filter((i: any) => Number(i.used) === 1)
                .map((item: any) => getUniqueKey(item))
        );

        return allNames.map((name: string) => {
            const filtered = trainingItems.filter((i: any) => String(i.collection_name) === name);
            const isExistingInProject = projectLabels.includes(name);

            // 🎯 [중복 계산 로직 복구]
            // 각 아이템의 고유 키를 추출하여 중복된 개수를 계산합니다.
            const keys = filtered.map((item: any) => getUniqueKey(item));
            const uniqueKeysCount = new Set(keys).size;
            const duplicateCount = filtered.length - uniqueKeysCount;

            // 🎯 모델이 있는 경우, 기존에 없던 레이블은 무조건 "허용 안됨"
            const isForbidden = hasModel && !isExistingInProject;

            const correctCount = filtered.filter((i: any) => Number(i.used) === 1).length;
            const counterCount = filtered.filter((i: any) => Number(i.used) === 0).length;

            const correctOk = correctCount >= 10;
            const counterOk = autoCollect ? (counterCount >= 10) : true;

            return {
                name,
                isNew: !isExistingInProject,
                isForbidden, // 🎯 모델이 있는데 새로 들어온 레이블인지 여부
                duplicateCount,
                correct: { count: correctCount, isOk: correctOk, percent: Math.min((correctCount / 10) * 100, 100) },
                counter: { count: counterCount, isOk: counterCount >= 10, percent: Math.min((counterCount / 10) * 100, 100) },
                // 🎯 통과 조건에 "금지된 레이블이 아님"을 추가
                isAllOk: correctOk && counterOk && !isForbidden
            };
        });
    }, [trainingItems, autoCollect, collectionInfo, hasModel]);

    const isReadyToProceed = useMemo(() => {
        if (requirementStats.length === 0) return false;
        return requirementStats.every(stat => stat.isAllOk);
    }, [requirementStats]);

    const processedItems = useMemo(() => {
        const counts = new Map();
        trainingItems.forEach((item: any) => {
            const key = getUniqueKey(item);
            counts.set(key, (counts.get(key) || 0) + 1);
        });

        return trainingItems.map((item: any) => ({
            ...item,
            isDuplicate: (counts.get(getUniqueKey(item)) || 0) > 1
        }));
    }, [trainingItems]);

    // const counterItems = (projectInfo?.is_counter_used && autoCollect)
    //     ? processedItems.filter((item: any) => Number(item.used) === 0)
    //     : [];
    const counterItems = processedItems.filter((item: any) => Number(item.used) === 0);
    const correctItems = processedItems.filter((item: any) => Number(item.used) === 1);
    const displayItems = activeTab === "correct" ? correctItems : counterItems;
    const itemTotalPages = Math.ceil(displayItems.length / itemsPerPage) || 1;
    const currentPagedItems = displayItems.slice((itemPage - 1) * itemsPerPage, itemPage * itemsPerPage);

    const handleItemLabelChange = (appNum: string, newLabel: string) => {
        setTrainingItems((prev: any[]) => prev.map(i => i.application_number === appNum ? { ...i, collection_name: newLabel } : i));
    };

    const handleToggleGroup = (group: any) => {
        const isAlreadyAdded = trainingItems.some((i: any) => i.group_code === group.group_code && i.data_status === 'ORIGINAL');
        if (isAlreadyAdded) {
            setTrainingItems((prev: any[]) => prev.filter((i: any) => !(i.group_code === group.group_code && i.data_status === 'ORIGINAL')));
        } else {
            const itemsToInsert = group.group_items.map((i: any) => ({
                ...i,
                collection_name: i.collection_name || group.group_name || "Unknown",
                data_status: 'ORIGINAL',
                used: Number(i.used ?? 1),
                group_code: group.group_code
            }));
            setTrainingItems((prev: any[]) => {
                const nextMap = new Map(prev.map(item => [item.application_number, item]));
                itemsToInsert.forEach((m: any) => { if (!nextMap.has(m.application_number)) nextMap.set(m.application_number, m); });
                return Array.from(nextMap.values());
            });
        }
    };

    const getItemUniqueKey = (item: any) => {
        const appNum = String(item.application_number || "").trim();
        const title = String(item.title || "").trim();
        const abstract = String(item.abstract || "").trim();

        // 출원번호가 있는 경우와 없는 경우를 모두 포괄하는 키 생성
        return appNum ? `${appNum}_${title}_${abstract}` : `${title}_${abstract}`;
    };

    const cleanDataForDB = (items: any[]) => items.map(item => ({
        ...item,
        application_number: (item.application_number && String(item.application_number).trim() !== "")
            ? String(item.application_number).trim()
            : null
    }));

    // new.tsx 내부의 handleAddDataFromSource
    const handleAddDataFromSource = (correctItems: any[], counterItems: any[]) => {
        setTrainingItems((prev: any[]) => {
            if (projectInfo?.source_type === "search") {
                const nextMap = new Map();

                // 기존 데이터 유지
                prev.forEach(i => { if (i?.application_number) nextMap.set(i.application_number, i); });

                // 🎯 [수정] 모델이 없더라도 넘어온 counterItems가 있다면 무조건 병합
                if (counterItems.length > 0) {
                    counterItems.forEach(item => {
                        if (item?.application_number && !nextMap.has(item.application_number)) {
                            nextMap.set(item.application_number, item);
                        }
                    });
                }

                // 선택한 긍정 데이터 병합 (최우선순위)
                correctItems.forEach(item => {
                    if (item?.application_number) nextMap.set(item.application_number, item);
                });
                return Array.from(nextMap.values());
            }

            const cleanedCorrect = cleanDataForDB(correctItems);
            const cleanedCounter = cleanDataForDB(counterItems);
            return [...prev, ...cleanedCorrect, ...cleanedCounter];
        });
    };

    const handleDeleteCollection = async (collectionName: string) => {
        if (!confirm(`'${collectionName}' 레이블과 관련된 모든 데이터를 삭제하시겠습니까?`)) return;

        // ✅ 1. 부모의 State(collectionInfo)에서 즉시 제거
        if (typeof setCollectionInfo === 'function') {
            setCollectionInfo((prev: any[]) => prev.filter(c => c.collection_name !== collectionName));
        }

        // ✅ 2. 내 바구니(trainingItems)에서도 해당 레이블 데이터 즉시 제거
        setTrainingItems((prev: any[]) =>
            prev.filter(item => String(item.collection_name) !== String(collectionName))
        );

        // 3. 백엔드 삭제 API 호출
        const target = collectionInfo?.find((c: any) => c.collection_name === collectionName);

        try {
            if (target) {
                const res = await fetch(`${API_BASE}/api/project/${projectInfo.id}/collections/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        items: [{ id: target.id, collection_code: target.collection_code }]
                    }),
                });

                if (!res.ok) throw new Error("서버 삭제 실패");

                // 4. 서버 데이터와 최종 동기화 (부모 리스트 새로고침)
                if (onPageChange) onPageChange(currentPage);
            }
        } catch (e) {
            console.error("삭제 중 오류:", e);
            alert("삭제 중 오류가 발생했습니다. 목록을 다시 불러옵니다.");
            if (onPageChange) onPageChange(currentPage); // 에러 발생 시 원복을 위해 새로고침
        }
    };

    const handleCleanupDuplicates = () => {
        setTrainingItems((prev: any[]) => {
            const seen = new Set();

            // 1️⃣ used: 1 인 데이터를 위로 정렬 (중복 발생 시 긍정 데이터를 남기기 위함)
            const sorted = [...prev].sort((a, b) => Number(b.used) - Number(a.used));

            // 2️⃣ 위에서 정의한 getUniqueKey 로직을 그대로 사용하여 필터링
            return sorted.filter(item => {
                const key = getUniqueKey(item); // 위에 만든 함수와 동일한 로직 사용
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        });
    };

    const totalGroupPages = Math.ceil(totalCount / perPage) || 1;

    return (
        <div className="flex flex-col gap-10 mx-auto pb-20">
            <div className="space-y-4">
                <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl space-y-8 animate-in fade-in">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg"><Layers size={24} /></div>
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase leading-none">데이터 추가</h2>
                        </div>
                    </div>

                    {/* 그룹명 설정 */}
                    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-10 shadow-sm relative overflow-hidden group">
                            <div className="absolute -top-10 -right-10 w-40 h-40 bg-zinc-100 rounded-full flex items-center justify-center opacity-50 group-hover:scale-110 transition-transform duration-500">
                                <Tag size={80} className="text-zinc-200 rotate-12" />
                            </div>

                            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        {/* <div className="w-1.5 h-6 bg-blue-600 rounded-full" /> */}
                                        <h3 className="text-xl font-bold text-zinc-900 tracking-tight">데이터 그룹명 설정</h3>
                                    </div>
                                    <p className="text-sm text-zinc-500 ml-4.5 font-medium">
                                        학습 데이터 세트를 식별할 수 있는 고유 이름을 입력하세요.
                                    </p>
                                </div>

                                <div className="relative flex-1 max-w-xl">
                                    <input
                                        type="text"
                                        value={groupName || ""}
                                        onChange={(e) => setGroupName(e.target.value)}
                                        placeholder={`${projectInfo?.project_name || 'Project'}_${new Date().toISOString().split('T')[0].replace(/-/g, '')}_...`}
                                        className="w-full bg-white border border-zinc-200 rounded-2xl px-6 py-4 text-base font-semibold text-zinc-900 outline-none focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-zinc-300 shadow-sm"
                                    />

                                    {!groupName && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-1.5 bg-zinc-100 rounded-lg border border-zinc-200 text-zinc-400 pointer-events-none">
                                            <Sparkles size={14} className="text-blue-600" />
                                            <span className="text-[10px] font-black uppercase tracking-wider">Auto-Gen</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className={`rounded-2xl border transition-all ${openSection === "groups" ? "border-blue-200 shadow-lg" : "border-zinc-200 shadow-sm"}`}>
                        <button onClick={() => setOpenSection("groups")} className={`w-full flex items-center justify-between p-6 ${openSection === "groups" ? "bg-blue-50/30" : "bg-white"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-1 rounded-xl ${openSection === "groups" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-400"}`}>
                                    {/* <Layers size={18} /> */}
                                </div>
                                <h4 className="font-bold text-zinc-900">그룹 데이터</h4>
                            </div>
                            <ChevronDown size={20} className={openSection === "groups" ? "rotate-180 text-blue-500" : ""} />
                        </button>
                        {openSection === "groups" && (
                            <div className="p-6 bg-white border-t space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {projectDataGroups?.groups.map((g: any) => {
                                        const isAdded = trainingItems.some((i: any) => i.group_code === g.group_code && i.data_status === 'ORIGINAL');
                                        return (
                                            <button key={g.id} onClick={() => handleToggleGroup(g)} className={`p-5 border-2 rounded-2xl flex items-center justify-between transition-all ${isAdded ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-zinc-50 border-zinc-100 hover:border-blue-400'}`}>
                                                <div className="text-left">
                                                    <div className="text-xs font-black text-zinc-700">{g.group_name}</div>
                                                    <div className="text-[10px] text-zinc-400 font-bold mt-0.5">{g.count} Records</div>
                                                </div>
                                                {isAdded ? <XCircle size={20} className="text-blue-500" /> : <Plus size={20} className="text-zinc-300" />}
                                            </button>
                                        );
                                    })}
                                </div>
                                {totalGroupPages > 1 && (
                                    <div className="flex justify-center items-center gap-4 pt-4 border-t border-zinc-50">
                                        <button disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)} className="p-2 rounded-lg border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50"><ChevronLeft size={18} /></button>
                                        <div className="text-[10px] font-black text-zinc-400">{currentPage} / {totalGroupPages}</div>
                                        <button disabled={currentPage === totalGroupPages} onClick={() => onPageChange(currentPage + 1)} className="p-2 rounded-lg border border-zinc-200 disabled:opacity-30 hover:bg-zinc-50"><ChevronRight size={18} /></button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className={`rounded-2xl border transition-all ${openSection === "acquisition" ? "border-blue-200 shadow-lg" : "border-zinc-200 shadow-sm"}`}>
                        <button onClick={() => setOpenSection("acquisition")} className={`w-full flex items-center justify-between p-6 ${openSection === "acquisition" ? "bg-blue-50/30" : "bg-white"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-1 rounded-xl ${openSection === "acquisition" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-400"}`}>
                                    {/* <Zap size={18} /> */}
                                </div>
                                <h4 className="font-bold text-zinc-900">데이터 검색</h4>
                            </div>
                            <ChevronDown size={20} className={openSection === "acquisition" ? "rotate-180 text-blue-500" : ""} />
                        </button>
                        {openSection === "acquisition" && (
                            <div className="p-6 bg-white border-t">
                                {projectInfo?.source_type === "search" ? (
                                    <SearchComponent
                                        autoCollect={autoCollect}
                                        setAutoCollect={setAutoCollect}
                                        projectInfo={projectInfo}
                                        collections={collectionInfo}
                                        correctDataItems={trainingItems}
                                        onAdd={handleAddDataFromSource}
                                        hasModel={hasModel}
                                        hasCounterClass={!!projectInfo?.has_counter_class}
                                    />
                                ) : (
                                    <div className="animate-in slide-in-from-top-4 duration-500">
                                        <UploadComponent
                                            onAdd={handleAddDataFromSource} // 정제 로직이 포함된 핸들러
                                            workstationItems={trainingItems}
                                            setWorkstationItems={setTrainingItems}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>


            {/* 상단 모니터링 섹션: requirementStats가 있으면 무조건 표시 */}
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                            <MonitorSmartphone size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase leading-none">데이터 현황</h2>
                            <p className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest leading-none">Real-time Data Quality Check</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* 미선택 데이터 사용 유무 */}
                        {projectInfo?.source_type === "search" && (
                            <div className="flex items-center gap-6 bg-zinc-50 px-6 py-4 rounded-[1.5rem] border border-zinc-100 shadow-inner mr-4">
                                <div className="flex flex-col items-end">
                                    <div className="flex items-center gap-2">
                                        {/* <Zap size={14} className={autoCollect ? "text-blue-600" : "text-zinc-300"} /> */}
                                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${autoCollect ? 'bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'bg-zinc-300'}`} />
                                        <span className="text-[11px] font-black text-zinc-900 uppercase tracking-widest leading-none">미선택 데이터 자동 수집</span>
                                    </div>
                                    <p className="text-[9px] text-zinc-400 font-bold mt-1.5">미선택 데이터를 부정 클래스로 포함</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !hasModel && setAutoCollect(!autoCollect)}
                                    disabled={hasModel}
                                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${hasModel ? 'opacity-50 cursor-not-allowed' : ''} ${autoCollect ? 'bg-orange-500' : 'bg-zinc-300'}`}
                                >
                                    <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-300 ${autoCollect ? 'translate-x-6' : 'translate-x-0'}`} />
                                </button>
                            </div>
                        )}

                        {/* 중복 정리 */}
                        {requirementStats.some(s => s.duplicateCount > 0) && (
                            <button
                                onClick={handleCleanupDuplicates} // 이전에 만든 정리 함수
                                className="px-6 py-4 bg-zinc-900 text-white rounded-full font-black text-sm shadow-xl hover:bg-black transition-all active:scale-95 flex items-center gap-2"
                            >
                                <RotateCw size={16} />
                                중복 데이터 정리
                            </button>
                        )}

                        <button
                            disabled={!isReadyToProceed || isLoading}
                            onClick={onNext}
                            className={`px-12 py-4 rounded-full font-black text-sm shadow-xl transition-all active:scale-95 ${isReadyToProceed
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100'
                                : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                                }`}
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={18} /> : "구성 확정 및 다음 단계"}
                        </button>
                    </div>
                </div>

                {requirementStats.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-zinc-100">
                        {/* {requirementStats.map(stat => (
                            <div key={stat.name} className={`p-5 rounded-[2rem] border-2 transition-all relative group ${stat.isAllOk ? 'bg-white border-green-200 shadow-sm' : 'bg-orange-50/50 border-orange-100'}`}>
                                {!hasModel && (
                                    <button onClick={() => handleDeleteCollection(stat.name)}
                                        className="absolute top-4 right-4 p-2 text-zinc-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 z-10">
                                        <Trash2 size={16} />
                                    </button>
                                )}

                                <div className="flex justify-between items-center mb-4 pr-6">
                                    <div className="flex items-center gap-2">
                                        <Tag size={16} className={stat.isAllOk ? 'text-green-500' : 'text-orange-500'} />
                                        <span className="text-sm font-black text-zinc-800 truncate max-w-[120px]">{stat.name}</span>
                                        
                                        {stat.duplicateCount > 0 && (
                                            <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full animate-pulse">
                                                중복 {stat.duplicateCount}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between text-[10px] font-black uppercase">
                                            <span>선택(Correct)</span>
                                            <span className={stat.correct.isOk ? 'text-green-600' : 'text-orange-600'}>
                                                {stat.correct.count}/10
                                            </span>
                                        </div>
                                        <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full transition-all duration-700"
                                                style={{
                                                    width: `${stat.correct.percent}%`,
                                                    backgroundColor: stat.correct.isOk ? '#22c55e' : '#f97316'
                                                }}
                                            />
                                        </div>
                                    </div>


                                    {(!hasModel) && (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-[10px] font-black uppercase">
                                                <span>미선택(Counter)</span>
                                                <span className={stat.counter.isOk ? 'text-green-600' : 'text-orange-600'}>
                                                    {stat.counter.count}/10
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all duration-700"
                                                    style={{
                                                        width: `${stat.counter.percent}%`,
                                                        backgroundColor: stat.counter.isOk ? '#22c55e' : '#f97316'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))} */}
                        {requirementStats.map(stat => {
                            // 🎯 로직 판단을 위한 변수
                            const isForbidden = hasModel && stat.isNew; // 모델이 있는데 새로운 레이블인 경우

                            return (
                                <div
                                    key={stat.name}
                                    className={`p-6 rounded-[2.5rem] border-2 transition-all relative group shadow-sm ${isForbidden
                                        ? 'bg-red-50/50 border-red-500 shadow-red-50' // 🎯 금지된 레이블: 붉은색 강한 경고
                                        : stat.isNew
                                            ? 'bg-blue-50/40 border-dashed border-blue-400' // 신규 레이블: 파란색 점선
                                            : stat.isAllOk
                                                ? 'bg-white border-green-200'
                                                : 'bg-orange-50/50 border-orange-100'
                                        }`}
                                >
                                    {/* 🎯 삭제 버튼 제어: 모델이 없거나, 금지된 레이블(모델은 있지만 데이터가 잘못 들어온 경우)만 삭제 버튼 노출 */}
                                    {(!hasModel || isForbidden) && (
                                        <button
                                            onClick={() => handleDeleteCollection(stat.name)}
                                            className={`absolute top-5 right-5 p-2 transition-all z-10 rounded-full shadow-sm ${isForbidden
                                                ? 'bg-red-500 text-white hover:bg-red-600 opacity-100'
                                                : 'bg-white/80 text-zinc-300 hover:text-red-500 opacity-0 group-hover:opacity-100'
                                                }`}
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}

                                    <div className="flex flex-col gap-1 mb-5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* 🎯 모델 존재 여부에 따른 배지 분기 */}
                                            {isForbidden ? (
                                                <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest flex items-center gap-1">
                                                    <Lock size={10} /> Forbidden
                                                </span>
                                            ) : stat.isNew ? (
                                                <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded-lg uppercase tracking-widest animate-pulse">
                                                    New Label
                                                </span>
                                            ) : null}

                                            {/* 중복 알림 배지 */}
                                            {stat.duplicateCount > 0 && (
                                                <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black rounded-lg uppercase tracking-widest">
                                                    DUP {stat.duplicateCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex justify-between items-center pr-6 mt-1">
                                            <div className="flex items-center gap-2">
                                                <Tag size={16} className={isForbidden ? 'text-red-500' : stat.isNew ? 'text-blue-500' : stat.isAllOk ? 'text-green-500' : 'text-orange-500'} />
                                                <span className={`text-sm font-black truncate max-w-[140px] ${isForbidden ? 'text-red-700' : 'text-zinc-800'}`}>
                                                    {stat.name}
                                                </span>
                                            </div>
                                            {isForbidden ? (
                                                <XCircle size={18} className="text-red-500" />
                                            ) : stat.isAllOk ? (
                                                <CheckCircle2 size={18} className="text-green-500" />
                                            ) : (
                                                <AlertCircle size={18} className={`${stat.isNew ? 'text-blue-400' : 'text-orange-400'} animate-pulse`} />
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-5">
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                                <span className="text-zinc-400">선택 (Correct)</span>
                                                <span className={stat.correct.isOk ? 'text-green-600' : 'text-orange-600'}>
                                                    {stat.correct.count} / 10
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all duration-700"
                                                    style={{
                                                        width: `${stat.correct.percent}%`,
                                                        backgroundColor: isForbidden ? '#ef4444' : stat.correct.isOk ? '#22c55e' : stat.isNew ? '#3b82f6' : '#f97316'
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {!hasModel && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                                    <span className="text-zinc-400">미선택 (Counter)</span>
                                                    <span className={stat.counter.isOk ? 'text-green-600' : 'text-orange-600'}>
                                                        {stat.counter.count} / 10
                                                    </span>
                                                </div>
                                                <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full transition-all duration-700 shadow-sm"
                                                        style={{
                                                            width: `${stat.counter.percent}%`,
                                                            backgroundColor: stat.counter.isOk ? '#22c55e' : '#f97316'
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 🎯 안내 문구 분기 */}
                                    {isForbidden ? (
                                        <div className="mt-4 p-2.5 bg-red-100/50 rounded-xl border border-red-200 text-center">
                                            <p className="text-[9px] font-black text-red-600">
                                                기존 모델의 레이블과 일치하지 않습니다.<br />해당 데이터를 삭제해주세요.
                                            </p>
                                        </div>
                                    ) : stat.isNew && (
                                        <p className="mt-4 text-[9px] font-bold text-blue-500 italic bg-blue-50 p-2 rounded-xl text-center border border-blue-100">
                                            * 이 레이블은 프로젝트에 새로 추가됩니다.
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="pt-10 pb-6 text-center text-zinc-400 border-t border-dashed">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-bold uppercase tracking-widest">데이터를 추가하여 요건 충족을 확인하세요</p>
                    </div>
                )}
            </div>
            <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-xl space-y-8 animate-in fade-in">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg">
                            <MonitorSmartphone size={24} />
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900 tracking-tighter uppercase leading-none">데이터 편집</h2>
                    </div>
                    {/* <button disabled={!isReadyToProceed || isLoading} onClick={onNext} className={`px-12 py-4 rounded-full font-black text-sm shadow-xl transition-all ${isReadyToProceed ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-zinc-100 text-zinc-300'}`}>
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : "구성 확정 및 다음 단계"}
                    </button> */}
                </div>
                {projectInfo?.source_type === "search" ? (
                    <div className="bg-zinc-50/50 p-2 rounded-[3.5rem] border border-zinc-100 mt-6">
                        <div className="flex gap-2 p-4 bg-white/80 backdrop-blur rounded-[2.5rem] border border-zinc-100 mb-6 w-fit mx-auto shadow-sm">
                            <button onClick={() => { setActiveTab("correct"); setItemPage(1); }} className={`px-10 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === "correct" ? "bg-blue-600 text-white shadow-lg" : "text-zinc-400"}`}>CORRECT ({correctItems.length})</button>
                            <button onClick={() => { setActiveTab("counter"); setItemPage(1); }} className={`px-10 py-3 rounded-2xl text-[10px] font-black transition-all ${activeTab === "counter" ? "bg-white text-orange-600 border border-orange-100 shadow-sm" : "text-zinc-400"}`}>COUNTER ({counterItems.length})</button>
                        </div>
                        <div className="space-y-4 px-4 pb-10">
                            {currentPagedItems.map((item: any) => (
                                // <div key={item.application_number} className="bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm flex items-start gap-8 relative group hover:border-blue-300">
                                <div
                                    key={item.application_number}
                                    className={`bg-white rounded-[2.5rem] p-8 border shadow-sm flex items-start gap-8 relative group transition-all ${item.isDuplicate
                                        ? 'border-red-500 ring-2 ring-red-50' // 중복일 때: 빨간 테두리 + 은은한 광원 효과
                                        : 'border-zinc-100 hover:border-blue-300' // 정상일 때: 기존 스타일
                                        }`}
                                >
                                    {item.isDuplicate && (
                                        <div className="absolute -top-3 left-10 bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse">
                                            중복
                                        </div>
                                    )}
                                    <div className="flex-none w-48">
                                        {hasModel ? (
                                            <select value={String(item.collection_name)} onChange={(e) => handleItemLabelChange(item.application_number, e.target.value)} className="w-full text-[11px] font-black p-3.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-xl outline-none">
                                                {collectionInfo?.map((c: any) => <option key={c.id} value={c.collection_name}>{String(c.collection_name)}</option>)}
                                            </select>
                                        ) : (
                                            <input value={String(item.collection_name)} onChange={(e) => handleItemLabelChange(item.application_number, e.target.value)} className="w-full text-[11px] font-black text-center px-4 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl outline-none focus:bg-white focus:border-blue-500" />
                                        )}
                                        <div className={`mt-4 text-[9px] font-black text-center uppercase py-1.5 rounded-full border ${Number(item.used) === 1 ? 'text-blue-500 border-blue-100 bg-blue-50/50' : 'text-orange-500 border-orange-100 bg-orange-50/50'}`}>{Number(item.used) === 1 ? 'Correct' : 'Counter'}</div>
                                    </div>
                                    <div className="flex-1 min-w-0 pt-1">
                                        <div className="font-bold text-zinc-900 truncate text-xl pr-24 tracking-tight leading-none">{String(item.title)}</div>
                                        <div className="text-[11px] text-zinc-400 font-mono mt-2">{String(item.application_number)}</div>
                                        <p className="text-sm text-zinc-500 mt-4 line-clamp-2 italic leading-relaxed">{String(item.abstract)}</p>
                                    </div>
                                    <button
                                        onClick={() => setTrainingItems((prev: any[]) => prev.filter((i: any) => i.application_number !== item.application_number))}
                                        className="p-3 text-zinc-200 hover:text-red-500 self-center transition-all hover:bg-red-50 rounded-2xl active:scale-90">
                                        <Trash2 size={24} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {itemTotalPages > 1 && (
                            <div className="p-6 bg-white border-t border-zinc-100 flex justify-center items-center gap-10 rounded-b-[3.5rem]">
                                <button onClick={() => setItemPage(p => Math.max(1, p - 1))} disabled={itemPage === 1} className="p-4 border-2 border-zinc-100 rounded-2xl disabled:opacity-20 hover:bg-zinc-50 transition-all"><ChevronLeft size={20} /></button>
                                <div className="text-sm font-black text-blue-600 tracking-widest">{itemPage} / {itemTotalPages}</div>
                                <button onClick={() => setItemPage(p => Math.min(itemTotalPages, p + 1))} disabled={itemPage === itemTotalPages} className="p-4 border-2 border-zinc-100 rounded-2xl disabled:opacity-20 hover:bg-zinc-50 transition-all"><ChevronRight size={20} /></button>
                            </div>
                        )}
                    </div>
                ) : (


                    <div className="space-y-6">
                        <SmartDataTable
                            data={trainingItems}
                            setData={setTrainingItems}
                        />
                        {/* <div className="flex justify-end">
                        <button
                            onClick={handleConfirmAdd}
                            className="bg-zinc-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-2xl flex items-center gap-3"
                        >
                            <CheckCircle2 size={18} className="text-blue-400" /> {trainingItems.length}건 바구니에 담기
                        </button>
                    </div> */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default function NewModelPage() {
    const router = useRouter();
    const { project_id } = router.query;
    const { data: session } = useSession();
    const token = (session as any)?.access_token;
    const { setState } = useUserTaskStore();
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;


    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [projectInfo, setProjectInfo] = useState<any>(null);
    const [collectionInfo, setCollectionInfo] = useState<any[]>([]);
    const [modelInfo, setModelInfo] = useState<any[]>([]);
    const [projectDataGroups, setProjectDataGroups] = useState<ProjectDataGroups | null>(null);
    const [trainingItems, setTrainingItems] = useState<ProjectData[]>([]);
    console.log(">>>trainingItems:", trainingItems)
    const [config, setConfig] = useState<TrainingConfig>({ model_name: '', model_desc: '', epoch: 10, batch_size: 32, learning_rate: 1e-5, max_length: 128, shuffle: true });
    const [groupName, setGroupName] = useState("");

    const hasModel = useMemo(() => modelInfo && (modelInfo as any).model_list?.length > 0, [modelInfo]);
    const [autoCollect, setAutoCollect] = useState(true);
    useEffect(() => {
        if (projectInfo) {
            if (hasModel) {
                setAutoCollect(!!projectInfo.is_counter_used);
            }
        }
    }, [projectInfo?.is_counter_used, hasModel]);
    const [savedGroupCode, setSavedGroupCode] = useState("");


    const [page, setPage] = useState(1);
    const [limit] = useState(6);
    const [totalCount, setTotalCount] = useState(0);

    const fetchAll = useCallback(async () => {
        if (!router.isReady || !project_id || !token) return;
        try {
            setIsLoading(true);
            const res = await fetch(`${API_BASE}/api/project/${project_id}/data/groups?page=${page}&limit=${limit}`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
            });
            const d = await res.json();
            setProjectInfo(d.project_info);
            setCollectionInfo(d.collection_info || []);
            setTotalCount(d.total_count);

            const mRes = await fetch(`${API_BASE}/api/project/${project_id}/models`, { headers: { 'Authorization': `Bearer ${token}` } });
            const mData = await mRes.json();
            setModelInfo(mData || []);

            if (d.project_data_groups) {
                const groups: ProjectGroupItems[] = Object.keys(d.project_data_groups).map(code => {
                    const groupData = d.project_data_groups[code];

                    return {
                        // 1. id (인터페이스가 number를 요구하므로 Number로 형변환)
                        id: Number(groupData.index || 0),

                        // 2. group_code
                        group_code: code,

                        // 3. group_name
                        group_name: groupData.data[0]?.group_name || code,

                        // 4. group_items
                        group_items: groupData.data || [],

                        // 5. count
                        count: Number(groupData.count || 0),

                        // 6. last_updated (필수 항목! 서버 데이터가 없다면 현재 시간이라도 넣어야 함)
                        last_updated: groupData.last_updated || new Date().toISOString(),

                    };
                });
                setProjectDataGroups({ groups, total_count: d.total_count } as any);
            }
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    }, [project_id, token, page, limit, router.isReady, API_BASE]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const handleStep1Submit = async () => {
        setIsLoading(true);
        try {
            console.log(groupName)
            let finalGroupName = groupName.trim();
            if (!finalGroupName) {
                const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
                // 바구니 데이터 분석
                const uniqueCollections = Array.from(new Set(trainingItems.map(item => item.collection_name)));
                const collectionTag = uniqueCollections.length === 1
                    ? uniqueCollections[0]
                    : `Mixed_${uniqueCollections.length}`;
                const projectName = projectInfo?.project_name || "Project";

                // 자동 생성 예: "의료분류_20260123_Mixed_3"
                finalGroupName = `${projectName}_${today}_${collectionTag}`;
            }

            if (!confirm(`데이터 그룹명을 '${finalGroupName}'으로 구성하시겠습니까?`)) {
                setIsLoading(false);
                return;
            }

            const payload = {
                items: trainingItems.filter((i: any) => Number(i.used) === 1),
                n_items: autoCollect ? trainingItems.filter((i: any) => Number(i.used) === 0) : [],
                group_name: finalGroupName,
                is_counter_used: autoCollect
            };

            const res = await fetch(`${API_BASE}/api/project/${project_id}/data/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (res.ok) {
                setSavedGroupCode(result.group_code);
                setStep(2);
            }
        } catch (e) {
            alert("저장 중 오류 발생");
            console.log(e)
        }
        finally { setIsLoading(false); }
    };

    const handleStartTraining = async () => {
        setIsLoading(true);
        try {
            setState({ isBusy: true, status: 'RUNNING', progress: 0 });

            const payload = {
                ...config,
                data_scope: "project",
                group_code: savedGroupCode,
            }

            const res = await fetch(`${API_BASE}/api/ai/train/classification/project/${project_id}`, {
                method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(payload)
            });
            if (res.ok) router.push(`/project/${project_id}/models`);
        } catch (e) {
            setState({ isBusy: false, status: 'AVAILABLE' }); alert("학습 실패");
            console.log(e)
        }
        finally { setIsLoading(false); }
    };

    return (
        <ProjectLayout
            projectNo={project_id as string}
            projectName={projectInfo?.project_name}
            projectDesc={projectInfo?.project_description}
            taskType={projectInfo?.task_type}
            sourceType={projectInfo?.source_type}
            collectionNum={projectInfo?.collection_num}
            CreatedDatetime={projectInfo?.created_datetime}
            UpdatedDatetime={projectInfo?.updated_datetime}
        >
            <main className="min-h-screen bg-white relative pb-20 font-sans antialiased">
                {/* <div className="max-w-6xl mx-auto px-5 py-12"> */}
                <div className="min-h-screen p-8 pb-32 font-sans antialiased">
                    <header className="flex flex-col md:flex-row md:items-end justify-between gap-10 border-zinc-100 pb-10">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                <h1 className="text-3xl font-bold text-zinc-900">모델 학습</h1>
                            </div>
                            <p className="text-zinc-600 ml-4">
                                프로젝트 데이터를 이용해 AI 모델을 학습합니다.
                            </p>
                        </div>
                        {/* <h1 className="text-4xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Training Pipeline<span className="text-blue-600">.</span></h1> */}
                        <nav className="flex gap-3">
                            <StepBadge num={1} label="데이터 설정" active={step === 1} done={step > 1} />
                            <StepBadge num={2} label="모델 설정" active={step === 2} done={step > 2} />
                            <StepBadge num={3} label="최종 확인" active={step === 3} done={step > 3} />
                        </nav>
                    </header>
                    <div className="flex flex-col justify-between gap-10 border-b border-zinc-100 pb-4 mb-10">
                        <ProjectTypeSection projectInfo={projectInfo} />
                    </div>
                    <div className="min-h-[700px]">
                        {step === 1 && (
                            <Step1Workstation
                                setSavedGroupCode={setSavedGroupCode} hasModel={hasModel} autoCollect={projectInfo?.source_type === "search" ? autoCollect : false} setAutoCollect={setAutoCollect}
                                projectInfo={projectInfo} projectDataGroups={projectDataGroups} modelInfo={modelInfo} collectionInfo={collectionInfo} setCollectionInfo={setCollectionInfo}
                                trainingItems={trainingItems} setTrainingItems={setTrainingItems} groupName={groupName} setGroupName={setGroupName}
                                onNext={handleStep1Submit} isLoading={isLoading}
                                currentPage={page} totalCount={totalCount} perPage={limit} onPageChange={setPage}
                                API_BASE={API_BASE} token={token}
                            />
                        )}
                        {step === 2 && (
                            // <div className="mx-auto py-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                            <div className="flex flex-col gap-10 mx-auto pb-20">
                                <div className="bg-white rounded-2xl border-2 border-zinc-100 shadow-2xl overflow-hidden p-16">
                                    <div className="flex items-center gap-4 mb-12">
                                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
                                            <Settings size={24} />
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">모델 아키텍처 및 파라미터 설정</h2>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 font-sans">
                                        {/* 왼쪽: 기본 정보 입력 */}
                                        <div className="space-y-10">
                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black uppercase text-zinc-400 tracking-[0.2em] ml-1">Model Identity</label>
                                                <input
                                                    value={config.model_name}
                                                    onChange={e => setConfig({ ...config, model_name: e.target.value })}
                                                    placeholder="모델의 고유 이름을 입력하세요"
                                                    className="w-full p-5 bg-zinc-50 border-2 border-zinc-100 rounded-[1.5rem] outline-none font-bold text-zinc-900 focus:border-blue-600 focus:bg-white transition-all placeholder:text-zinc-300 shadow-sm"
                                                />
                                            </div>

                                            <div className="space-y-3">
                                                <label className="text-[11px] font-black uppercase text-zinc-400 tracking-[0.2em] ml-1">Objective Description</label>
                                                <textarea
                                                    value={config.model_desc}
                                                    onChange={e => setConfig({ ...config, model_desc: e.target.value })}
                                                    placeholder="학습 목적이나 특이사항을 기록하세요"
                                                    rows={4}
                                                    className="w-full p-5 bg-zinc-50 border-2 border-zinc-100 rounded-[1.5rem] outline-none text-sm font-medium text-zinc-600 focus:border-blue-600 focus:bg-white transition-all resize-none placeholder:text-zinc-300 shadow-sm"
                                                />
                                            </div>

                                            {/* 데이터 섞기 토글 스위치 */}
                                            <div className="flex items-center justify-between p-6 bg-zinc-50 border-2 border-zinc-100 rounded-[1.5rem] transition-all hover:border-zinc-200">
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2.5 rounded-xl transition-all ${config.shuffle ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-zinc-200 text-zinc-400'}`}>
                                                        <RotateCw size={18} className={config.shuffle ? 'animate-spin' : ''} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-[11px] font-black text-zinc-900 uppercase tracking-widest leading-none">Shuffle Dataset</h4>
                                                        <p className="text-[9px] text-zinc-400 mt-1 font-bold">데이터를 무작위로 섞어 학습 효율을 높입니다.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setConfig({ ...config, shuffle: !config.shuffle })}
                                                    className={`relative w-14 h-8 rounded-full transition-all duration-300 ${config.shuffle ? 'bg-blue-600' : 'bg-zinc-200'}`}
                                                >
                                                    <div className={`absolute top-1 left-1 bg-white w-6 h-6 rounded-full shadow-md transition-transform duration-300 ${config.shuffle ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* 오른쪽: 하이퍼파라미터 설정 (밝은 테마 버전) */}
                                        <div className="space-y-6">
                                            {[
                                                { label: '학습 횟수(Epochs)', key: 'epoch', sub: 'Training Iterations' },
                                                { label: '학습률(Learning Rate)', key: 'learningRate', sub: 'Optimization Step Size' },
                                                { label: '문장 최대 길이(Max Size)', key: 'maxLength', sub: 'Sequence Token Limit' },
                                                { label: '배치 사이즈(Batch Size)', key: 'batchSize', sub: 'Samples per Step' },
                                            ].map((param) => (
                                                <div key={param.key} className="p-6 bg-white border-2 border-zinc-100 rounded-[1.5rem] flex items-center justify-between shadow-sm hover:border-blue-100 transition-all">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-zinc-800">{param.label}</h4>
                                                        <p className="text-[10px] text-zinc-400 uppercase font-black tracking-tighter">{param.sub}</p>
                                                    </div>
                                                    <input
                                                        type="number"
                                                        value={config[param.key as keyof TrainingConfig] as any}
                                                        onChange={e => setConfig({ ...config, [param.key as keyof TrainingConfig]: +e.target.value })}
                                                        className="w-32 p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-center font-black text-xl text-blue-600 outline-none focus:border-blue-600 focus:bg-white transition-all"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-16 flex gap-6">
                                        <button onClick={() => setStep(1)} className="px-10 py-5 bg-zinc-100 text-zinc-500 rounded-full font-bold hover:bg-zinc-200 transition-all">이전 단계</button>
                                        <button onClick={() => setStep(3)} className="flex-1 py-5 bg-blue-600 text-white rounded-full font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all">구성 확정 및 최종 확인</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        {step === 3 && (
                            <div className="mx-auto py-12 animate-in zoom-in-95 duration-700">
                                <div className="bg-white rounded-[3rem] border-2 border-zinc-100 shadow-2xl p-16 text-center space-y-12 overflow-hidden relative">

                                    <div className="flex items-center gap-4 mb-12">
                                        <div className="p-3 bg-blue-600 rounded-2xl text-white shadow-lg shadow-blue-100">
                                            <Settings size={24} />
                                        </div>
                                        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">학습 시작</h2>
                                        <p className="text-zinc-400 text-sm font-medium mt-2">최종 설정을 확인하고 학습 엔진을 배포하세요</p>
                                    </div>

                                    {/* 배경 장식: 시그니처 블루 은은한 원형 광원 */}
                                    {/* <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-50 rounded-full blur-[80px] pointer-events-none" /> */}

                                    {/* <div className="relative">
                                        <div className="w-24 h-24 bg-blue-50 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner">
                                            <PlayCircle size={48} className="text-blue-600 drop-shadow-md" />
                                        </div>
                                        <h2 className="text-3xl font-black text-zinc-900 tracking-tighter uppercase italic">Ready to Initialize.</h2>
                                    </div> */}

                                    {/* 요약 대시보드 */}
                                    <div className="bg-zinc-50 border border-zinc-200 rounded-[2.5rem] p-10 space-y-10 text-left">
                                        <div className="grid grid-cols-2 gap-10">
                                            <div className="space-y-1.5 border-l-2 border-blue-600 pl-6">
                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Selected Project</span>
                                                <span className="text-lg font-bold text-zinc-900 block">{projectInfo?.project_name}</span>
                                            </div>
                                            <div className="space-y-1.5 border-l-2 border-zinc-300 pl-6">
                                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Model Label</span>
                                                <span className="text-lg font-bold text-blue-600 block">{config.model_name || "Untitled Model"}</span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-3 gap-6 pt-10 border-t border-zinc-200 text-center font-black tracking-tighter">
                                            <div className="p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                                                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Correct</span>
                                                <span className="text-3xl text-zinc-900">{trainingItems.filter((i: any) => Number(i.used) === 1).length}</span>
                                            </div>
                                            <div className="p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                                                <span className="text-[10px] text-zinc-400 uppercase block mb-1">Counter</span>
                                                <span className="text-3xl text-zinc-900">{trainingItems.filter((i: any) => Number(i.used) === 0).length}</span>
                                            </div>
                                            <div className="p-4 bg-blue-600 rounded-2xl shadow-lg shadow-blue-100 text-white">
                                                <span className="text-[10px] text-blue-200 uppercase block mb-1">Total Assets</span>
                                                <span className="text-3xl">{trainingItems.length}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <button
                                            onClick={handleStartTraining}
                                            disabled={isLoading}
                                            className="w-full bg-blue-600 text-white py-8 rounded-[2.5rem] font-black text-xl uppercase tracking-widest shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:bg-zinc-200"
                                        >
                                            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : "학습 시작"}
                                        </button>
                                        <button onClick={() => setStep(2)} className="text-sm font-bold text-zinc-400 hover:text-zinc-600 transition-colors uppercase tracking-widest">← Back to Setup</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </ProjectLayout>
    );
}