// /frontend/pages/project/[project_id]/collection/index.tsx
import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Head from "next/head";
import {
  Search, Plus, Loader2, ArrowLeft, Eye, Trash2, ArrowRight,
  CheckSquare, Square, X, Network, PieChart as PieIcon, Lock, RotateCw, MonitorSmartphone
} from "lucide-react";

import ProjectLayout from "@/components/layouts/ProjectLayout";
import AddCollectionModal from "@/components/collection/AddCollectionModal";
import StatsDashboard from "@/components/collection/StatsDashboard";
import CollectionDataView from "@/components/collection/CollectionDataView";
import { useCollectionActions } from "@/hooks/project/useCollectionActions";
import { withMessages } from '@/lib/i18n/withMessages';
import { CollectionInfo } from "@/types/collection";

import SearchComponent from "@/components/project/SearchComponent";
import UploadComponent from "@/components/project/UploadComponent";
import ReviewWorkstation from "@/components/project/ReviewWorkstation";
import ProjectTypeSection from "@/components/project/ProjectTypeSection";
import SmartDataTable from "@/components/project/SmartDataTable";

export const getServerSideProps = withMessages();

export default function IntegratedProjectPage() {
  const workstationRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { project_id, collection_name } = router.query;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const { data: session } = useSession();
  const token = (session as any)?.access_token;

  // --- UI 상태 ---
  const [viewMode, setViewMode] = useState<"table" | "grid" | "stats" | "add_data" | "preview">("table");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  // --- 데이터 상태 ---
  const [stats, setStats] = useState<any>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [modelInfo, setModelInfo] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [groupName, setGroupName] = useState("");

  // --- 작업 및 선택 상태 ---
  const [workstationItems, setWorkstationItems] = useState<any[]>([]);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<{ id: number, code: string }[]>([]);

  const [autoCollect, setAutoCollect] = useState(true);
  const hasModel = useMemo(() => !!(modelInfo && modelInfo.length > 0), [modelInfo]);
  const hasCounterClass = useMemo(() => !!stats?.project_info?.is_counter_used, [stats]);
  // const isToggleLocked = useMemo(() => hasModel || !hasCounterClass, [hasModel, hasCounterClass]);
  const isToggleLocked = useMemo(() => !!hasModel, [hasModel]);

  useEffect(() => {
    if (stats?.project_info) {
      setAutoCollect(!!stats.project_info.is_counter_used);
    }
  }, [stats?.project_info?.is_counter_used]);

  // 🎯 데이터 로드 함수
  const loadAllData = useCallback(async () => {
    if (!project_id || !token) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/project/${project_id}/collection?page=1&limit=100&q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCollections(data.collection_info || []);
      setModelInfo(data.model_info || []);

      const resStats = await fetch(`${API_BASE}/api/project/${project_id}/stats`, { headers: { Authorization: `Bearer ${token}` } });
      setStats(await resStats.json());
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [project_id, token, query, API_BASE]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  // 🎯 [복구] 상세 보기 로직
  const loadPreviewData = useCallback(async (targetName: string) => {
    if (!project_id || !token) return;
    try {
      setPreviewLoading(true);
      const res = await fetch(`${API_BASE}/api/project/${project_id}/preview`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const filtered = (data.items || []).filter((item: any) => item.collection_name === targetName);
      setPreviewItems(filtered);
      setViewMode("preview");
    } catch (e) { alert("데이터 로드 실패"); } finally { setPreviewLoading(false); }
  }, [project_id, token, API_BASE]);

  useEffect(() => {
    if (collection_name) loadPreviewData(collection_name as string);
    else if (viewMode === "preview") setViewMode("table");
  }, [collection_name, loadPreviewData]);

  const { addCollection, deleteCollections, isActionLoading } = useCollectionActions(project_id as string, token as string, loadAllData);

  const handleBackToList = () => {
    const { collection_name: _c, ...restQuery } = router.query;
    router.push({ query: restQuery }, undefined, { shallow: true });
    setViewMode("table");
    setWorkstationItems([]);
  };

  const toggleSelect = (id: number, code: string) => {
    setSelectedCollections(prev => prev.some(s => s.id === id) ? prev.filter(s => s.id !== id) : [...prev, { id, code }]);
  };
  const handleSaveWorkstation = async () => {
    // if (!confirm(`${workstationItems.length}건의 데이터를 프로젝트에 저장하시겠습니까?`)) return;
    if (duplicateCount > 0) {
      alert(`중복 데이터 ${duplicateCount}건이 존재합니다. 정제 후 저장해주세요.`);
      return;
    }

    let finalGroupName = groupName.trim();
    if (!finalGroupName) {
      const uniqueCollections = Array.from(new Set(workstationItems.map(item => item.collection_name)));
      const collectionDisplay = uniqueCollections.length === 1
        ? uniqueCollections[0]
        : `Mixed-${uniqueCollections.length}`;

      // const today = new Date().toISOString().split('T')[0].replace(/-/g, ''); // 20260123 형식
      const today = new Date().toISOString().split('T')[0]; // 2026-01-23 형식
      const projectName = stats?.project_info?.project_name || "Project";

      // 최종 조합 예시: ProjectA_20260123_Mixed_3
      finalGroupName = `${projectName} [${today}] ${collectionDisplay}`;
      if (!confirm(`데이터 그룹명을 '${finalGroupName}'으로 저장하시겠습니까?`)) return;

    }

    try {
      const correctToSave = workstationItems.filter(item => Number(item.used) === 1);
      const counterToSave = workstationItems.filter(item => Number(item.used) === 0);

      // 예전 코드의 데이터 구조(payload) 복구
      const payload = {
        items: correctToSave,    // Correct 데이터
        n_items: counterToSave,   // Counter 데이터
        group_name: finalGroupName
      };

      const res = await fetch(`${API_BASE}/api/project/${project_id}/data/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      if (res.ok) { setWorkstationItems([]); loadAllData(); setViewMode("table"); }
    } catch (e) { alert("저장 실패"); }
  };

  // 🎯 [사용자 제안 로직 1] 지능형 식별자 생성
  const getItemUniqueKey = (item: any) => {
    if (item.application_number && String(item.application_number).trim() !== "") {
      return `app_${item.application_number}`;
    }
    return `text_${item.title}_${item.abstract}`;
  };
  const handleAddDataFromSource = useCallback((correctItems: any[], counterItems: any[]) => {
    setWorkstationItems(prev => {
      if (stats?.project_info?.source_type === "search") {

        const nextMap = new Map();
        prev.forEach(item => nextMap.set(getItemUniqueKey(item), item));

        // 1. Counter 데이터 병합
        counterItems.forEach(item => {
          const key = getItemUniqueKey(item);
          if (!nextMap.has(key)) nextMap.set(key, item);
        });

        // 2. Correct 데이터 병합 (우선순위)
        correctItems.forEach(item => {
          nextMap.set(getItemUniqueKey(item), item);
        });

        return Array.from(nextMap.values());
      }
      if (stats?.project_info?.source_type === "upload") {
        return [...prev, ...correctItems];
      }

      return prev;
    });

    // 🎯 [Snap!] 데이터가 들어가면 현황판이 있는 위치로 부드럽게 스크롤
    setTimeout(() => {
      workstationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [getItemUniqueKey]);

  // 🎯 [사용자 제안 로직 2] 실시간 중복 건수 계산
  const duplicateCount = useMemo(() => {
    if (!workstationItems.length) return 0;
    const keys = workstationItems.map(getItemUniqueKey);
    return workstationItems.length - new Set(keys).size;
  }, [workstationItems]);

  // 🎯 [사용자 제안 로직 3] 중복 제거 실행 (최신 데이터 유지)
  const handleCleanUp = useCallback(() => {
    const uniqueMap = new Map();
    workstationItems.forEach(item => {
      const key = getItemUniqueKey(item);
      uniqueMap.set(key, item); // 덮어쓰기로 최신 유지
    });
    const cleaned = Array.from(uniqueMap.values());
    const removedCount = workstationItems.length - cleaned.length;

    setWorkstationItems(cleaned);
    if (removedCount > 0) {
      alert(`${removedCount}건의 중복 항목이 정리되었습니다.`);
    }
  }, [workstationItems]);

  // 1️⃣ 지능형 식별자 생성 (new.tsx와 동일하게 일치)
  const getUniqueKey = useCallback((item: any) => {
    const title = String(item.title || "").trim();
    const abstract = String(item.abstract || "").trim();
    const appNum = String(item.application_number || "").trim();
    return appNum ? `ID:${appNum}_T:${title}_A:${abstract}` : `T:${title}_A:${abstract}`;
  }, []);

  // 2️⃣ 실시간 요건 검증 통계 (현황판 데이터)
  const requirementStats = useMemo(() => {
    const dbNames = (collections || []).map((c: any) => c.collection_name);
    const basketNames = workstationItems.map((i: any) => i.collection_name);

    // DB에 이미 있는 이름 + 바구니에 새로 담긴 이름 합집합
    const allNames = Array.from(new Set([...dbNames, ...basketNames])).filter(Boolean);

    return allNames.map((name: any) => {
      const filtered = workstationItems.filter((i: any) => String(i.collection_name) === String(name));
      const keys = filtered.map(item => getUniqueKey(item));
      const uniqueKeysCount = new Set(keys).size;

      // 중복 계산: 이 레이블 내에서의 중복 건수
      const duplicateCount = filtered.length - uniqueKeysCount;

      const correctCount = filtered.filter((i: any) => Number(i.used) === 1).length;
      const counterCount = filtered.filter((i: any) => Number(i.used) === 0).length;

      const correctOk = correctCount >= 10;
      // 검색 기반 프로젝트인 경우에만 Counter 10건 요건 적용
      const isSearchProject = stats?.project_info?.source_type === "search";
      const counterOk = (isSearchProject && autoCollect) ? (counterCount >= 10) : true;

      return {
        name,
        correct: { count: correctCount, isOk: correctOk, percent: Math.min((correctCount / 10) * 100, 100) },
        counter: { count: counterCount, isOk: counterOk, percent: Math.min((counterCount / 10) * 100, 100) },
        duplicateCount,
        isAllOk: correctOk && counterOk
      };
    });
  }, [workstationItems, collections, autoCollect, stats?.project_info]);

  // 3️⃣ 리스트 표시용 데이터 (중복 여부 포함)
  const processedWorkstationItems = useMemo(() => {
    const counts = new Map();
    workstationItems.forEach(item => {
      const key = getUniqueKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return workstationItems.map(item => ({
      ...item,
      isDuplicate: counts.get(getUniqueKey(item)) > 1
    }));
  }, [workstationItems, getUniqueKey]);

  return (
    <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
      <Head><title>Data Assets | IPFORCE</title></Head>
      {/* <ProjectTypeSection projectInfo={stats?.project_info} /> */}

      <div className="min-h-screen p-8 pb-32 font-sans antialiased">

        <div className="max-w-7xl mx-auto">

          {/* 1. 상단 헤더 & 뷰 전환 (상세보기/보강모드 아닐 때) */}
          {viewMode !== "preview" && viewMode !== "add_data" && (
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-8 font-sans">
              {/* <div className="space-y-2">
                <h1 className="text-5xl font-black text-zinc-900 tracking-tighter uppercase leading-none">Data Hub.</h1>
                <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest ml-1">Asset Management & Analytics</p>
              </div> */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                  <h1 className="text-3xl font-bold text-zinc-900">컬렉션 목록</h1>
                </div>
                <p className="text-zinc-600 ml-4">
                  이 프로젝트로 학습된 모든 AI 모델을 관리합니다.
                </p>
              </div>
              <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm gap-1">
                {[{ label: "Table", mode: "table" }, { label: "Cards", mode: "grid" }, { label: "Stats", mode: "stats" }].map((item) => (
                  <button key={item.mode} onClick={() => setViewMode(item.mode as any)} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${viewMode === item.mode ? 'bg-blue-600 text-white shadow-lg' : 'text-zinc-400 hover:text-zinc-600'}`}>{item.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* 2. 메인 콘텐츠 */}
          {loading || previewLoading ? (
            <div className="py-48 text-center"><Loader2 className="w-16 h-16 animate-spin mx-auto text-blue-600 opacity-20" /></div>
          ) : viewMode === "preview" ? (
            /* 🎯 [복구] 상세보기 뷰 */
            <CollectionDataView collectionName={collection_name as string} items={previewItems} onBack={handleBackToList} />
          ) : viewMode === "stats" ? (
            /* 🎯 통계 뷰 (기능 보존) */
            <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex gap-4 p-1.5 bg-zinc-100 rounded-2xl w-fit border shadow-inner font-sans">
                <button className="flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black bg-white text-blue-600 shadow-md uppercase"><PieIcon size={14} /> 분포 분석</button>
                <button onClick={() => router.push(`/project/${project_id}/collection/analysis`)} className="flex items-center gap-2 px-8 py-3 rounded-xl text-[10px] font-black text-zinc-400 hover:text-zinc-600 transition-all uppercase"><Network size={14} /> 클러스터 이동</button>
              </div>
              <StatsDashboard stats={stats} />
            </div>
          ) : viewMode === "add_data" ? (
            /* 🎯 보강 모드 (기존 기능 유지) */
            <div className="space-y-12 animate-in fade-in duration-700">
              <div className="flex items-center justify-between">
                <button onClick={handleBackToList} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-black text-[10px] uppercase tracking-widest transition-all">
                  <ArrowLeft size={16} /> Exit Augmentation
                </button>

                {/* 🎯 [추가] 검색 프로젝트일 때만 노출되는 전역 설정 토글 */}
                {stats?.project_info?.source_type === "search" && (
                  <div className={`flex items-center gap-6 px-6 py-4 rounded-[1.5rem] border transition-all ${isToggleLocked ? 'bg-zinc-50 border-zinc-100 opacity-60' : 'bg-white border-zinc-200 shadow-sm'
                    }`}>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-2">
                        {/* 상태에 따른 아이콘 변경 */}
                        {isToggleLocked ? (
                          <Lock size={12} className="text-zinc-400" />
                        ) : (
                          <div className={`w-2 h-2 rounded-full ${autoCollect ? 'bg-orange-500 animate-pulse' : 'bg-zinc-300'}`} />
                        )}
                        <span className={`text-[11px] font-black uppercase tracking-widest ${isToggleLocked ? 'text-zinc-400' : 'text-zinc-900'}`}>
                          미선택 데이터 수집
                        </span>
                      </div>
                      <p className="text-[9px] text-zinc-400 font-bold mt-1">
                        {autoCollect ? "미선택 데이터를 부정 클래스로 포함" : "이 프로젝트는 Counter 기능을 사용하지 않습니다"}
                      </p>
                    </div>

                    {/* 토글 버튼 */}
                    <button
                      type="button"
                      onClick={() => !isToggleLocked && setAutoCollect(!autoCollect)}
                      disabled={isToggleLocked}
                      className={`relative w-14 h-8 rounded-full transition-all duration-300 shadow-inner ${
                        // 🎯 배경색 로직: 잠금 상태여도 주황색 계열을 유지해서 ON임을 표시
                        isToggleLocked
                          ? (autoCollect ? 'bg-orange-500/80' : 'bg-zinc-100')
                          : (autoCollect ? 'bg-orange-500' : 'bg-zinc-300')
                        } ${isToggleLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-4 hover:ring-orange-50'}`}
                    >
                      <div className={`absolute top-1 left-1 w-6 h-6 rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${autoCollect ? 'translate-x-6' : 'translate-x-0'
                        } ${isToggleLocked ? 'bg-zinc-300' : 'bg-white'
                        }`}>
                        {isToggleLocked && <Lock size={10} className="text-zinc-500" />}
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* <button onClick={handleBackToList} className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-black text-[10px] uppercase tracking-widest transition-all">
                <ArrowLeft size={16} /> Exit Augmentation</button> */}

              {stats?.project_info?.source_type === "search" && (
                <div className="rounded-2xl border-2 border-blue-50 bg-white p-12 shadow-2xl">
                  <SearchComponent
                    autoCollect={autoCollect}
                    setAutoCollect={setAutoCollect}
                    projectInfo={stats?.project_info}
                    collections={collections}
                    correctDataItems={workstationItems}
                    onAdd={handleAddDataFromSource}
                    hasModel={hasModel}
                    hasCounterClass={hasCounterClass}
                  />
                </div>
              )}
              <div ref={workstationRef} className="scroll-mt-10">
                <ReviewWorkstation
                  items={workstationItems}
                  onItemsUpdate={setWorkstationItems}
                  onRemove={(appNum) => setWorkstationItems(prev => prev.filter(i => i.application_number !== appNum))}
                  onLabelChange={(appNum, label) => setWorkstationItems(prev => prev.map(i => i.application_number === appNum ? { ...i, collection_name: label } : i))}
                  collectionInfo={collections}
                  autoCollect={autoCollect} hasModel={hasModel} hasCounterClass={hasCounterClass}
                  sourceType={stats?.project_info?.source_type}
                  onCleanUp={() => { }}
                  duplicateCount={0}
                />
              </div>
              {stats?.project_info?.source_type === "upload" && (
                <div className="rounded-2xl border-2 border-blue-50 bg-white p-12 shadow-2xl">

                  <UploadComponent
                    workstationItems={workstationItems}
                    setWorkstationItems={setWorkstationItems}
                    onAdd={handleAddDataFromSource}
                  />
                  {/* 편집 테이블 및 담기 버튼 */}
                  {workstationItems.length > 0 && (
                    <div className="space-y-6">
                      <SmartDataTable
                        data={workstationItems}
                        setData={setWorkstationItems}
                      />
                      {/* <div className="flex justify-end">
                        <button
                            onClick={handleConfirmAdd}
                            className="bg-zinc-900 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase shadow-2xl flex items-center gap-3"
                        >
                            <CheckCircle2 size={18} className="text-blue-400" /> {workstationItems.length}건 바구니에 담기
                        </button>
                    </div> */}
                    </div>
                  )}
                </div>
              )}

              {workstationItems.length > 0 && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-8">
                  <div className="bg-zinc-900/95 backdrop-blur-xl px-12 py-7 rounded-[3rem] shadow-3xl flex items-center gap-8 border border-white/10 ring-[12px] ring-zinc-900/10 font-sans">

                    {/* 1. 요약 정보 (왼쪽 고정) */}
                    <div className="flex-none border-r border-white/10 pr-8">
                      <p className="text-white font-black text-xl tracking-tighter">
                        <span className="text-blue-400">{workstationItems.length}</span>
                        <span className="ml-2 text-sm text-zinc-500 uppercase tracking-widest">Objects</span>
                      </p>
                    </div>

                    {/* 2. 그룹 이름 입력 (중앙 배치) */}
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="그룹 이름 입력 (미입력 시 자동 생성)..."
                        className="bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white outline-none focus:border-blue-500/50 focus:bg-white/10 transition-all min-w-[280px] placeholder:text-zinc-500"
                      />
                    </div>

                    {/* 3. 액션 버튼 그룹 (오른쪽 정렬) */}
                    <div className="flex items-center gap-3">
                      {/* 메인 저장 버튼 */}
                      <button
                        onClick={handleSaveWorkstation}
                        className="bg-blue-600 text-white px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest hover:bg-blue-500 shadow-2xl transition-all active:scale-95 whitespace-nowrap"
                      >
                        저장하기
                      </button>

                      {/* 중복 제거 버튼: 저장 버튼 옆에 배치하여 정제 후 바로 저장하도록 유도 */}
                      {duplicateCount > 0 && (
                        <button
                          onClick={handleCleanUp}
                          className="flex items-center gap-3 px-6 py-5 bg-orange-500 text-white rounded-[1.5rem] hover:bg-orange-600 transition-all active:scale-95 shadow-xl shadow-orange-500/20 group animate-in zoom-in"
                        >
                          <span className="text-xs font-black uppercase whitespace-nowrap">{`중복 제거 (${duplicateCount})`}</span>
                        </button>
                      )}

                      {/* 비우기 버튼 (아이콘 변경 반영) */}
                      <button
                        onClick={() => { if (confirm('바구니를 비우시겠습니까?')) setWorkstationItems([]); }}
                        className="p-4 text-zinc-500 hover:text-white hover:bg-white/5 rounded-2xl transition-all"
                        title="바구니 비우기"
                      >
                        <RotateCw size={22} />
                      </button>
                    </div>

                  </div>
                </div>
              )}
            </div>
          ) : (
            /* 3. 목록 화면 (기존의 모든 UI 로직 보존) */
            <>


              <div className="flex flex-col md:flex-row gap-5 mb-12 items-center font-sans">
                <div className="relative flex-1 group w-full">
                  {/* <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300" /> */}
                  <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                  {/* <input 
                    className="w-full bg-white border border-zinc-200 rounded-[2rem] pl-16 pr-6 py-5 shadow-sm outline-none font-bold text-zinc-700" 
                    placeholder="Search..." 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} /> */}
                  <input type="text"
                    className="w-full rounded-xl border border-zinc-200 pl-12 pr-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
                    placeholder="컬렉션 검색"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <button onClick={() => setViewMode("add_data")}
                    // className="flex-1 md:flex-none bg-indigo-600 text-white px-10 py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest"
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    <Plus size={18} />
                    데이터 추가</button>
                  {!hasModel &&
                    <button onClick={() => setIsAddModalOpen(true)}
                      // className="flex-1 md:flex-none bg-blue-600 text-white px-10 py-5 rounded-[1.5rem] font-black shadow-xl hover:bg-blue-700 flex items-center justify-center gap-3 text-[10px] uppercase tracking-widest active:scale-95"
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      <Plus size={18} />
                      컬렉션 추가
                    </button>}
                </div>
              </div>

              {hasModel && (
                <div className="mb-10 p-6 bg-amber-50 border-2 border-amber-100 rounded-[2.5rem] flex items-center gap-5 text-amber-800 shadow-sm font-sans font-bold italic">
                  <Lock size={24} className="text-amber-500" /> Structure Locked: 컬렉션 추가/삭제가 제한됩니다.
                </div>
              )}

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                  {collections.map(c => {
                    const isSelected = selectedCollections.some(s => s.id === c.id);
                    return (
                      <div key={c.id} className={`group bg-white p-10 rounded-[3.5rem] border-2 transition-all relative border-transparent hover:border-zinc-100 hover:shadow-xl ${isSelected ? 'ring-4 ring-blue-50' : ''}`}>
                        <button onClick={() => toggleSelect(c.id, c.collection_code)} className="absolute top-10 right-10">
                          {isSelected ? <CheckSquare className="text-blue-600" size={28} /> : <Square className="text-zinc-100 group-hover:text-zinc-200" size={28} />}
                        </button>
                        <ArrowRight className="text-zinc-200 group-hover:text-blue-600 transition-colors" />
                        <div onClick={() => router.push(`/project/${project_id}/collection/${c.id}`)} className="cursor-pointer font-sans">
                          <h3 className="text-2xl font-black text-zinc-900 truncate uppercase">{c.collection_name}</h3>
                          <p className="text-[10px] font-mono text-zinc-300 mb-10 tracking-[0.2em] uppercase font-black">{c.collection_code}</p>
                        </div>
                        <div className="flex justify-between items-end pt-8 border-t border-zinc-50 font-sans">

                          <div className="text-xl font-black text-blue-600">{(c as any).collection_data_num || 0} <span className="text-[9px] text-zinc-400 font-bold uppercase ml-1">Items</span></div>
                          <div className="flex gap-1.5">
                            <button onClick={() => router.push({ query: { ...router.query, collection_name: c.collection_name } }, undefined, { shallow: true })} className="p-4 bg-zinc-50 text-zinc-400 hover:bg-zinc-900 hover:text-white rounded-2xl transition-all shadow-sm"><Eye size={20} /></button>
                            {!hasModel && <button onClick={() => { if (confirm('삭제?')) deleteCollections([{ id: c.id, code: c.collection_code }]) }} className="p-4 bg-zinc-50 text-zinc-400 hover:bg-red-500 hover:text-white rounded-2xl transition-all shadow-sm"><Trash2 size={20} /></button>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-white rounded-[3.5rem] border shadow-2xl overflow-hidden border-zinc-100 font-sans animate-in fade-in duration-500">
                  <table className="w-full text-left text-sm font-bold">
                    <thead className="bg-zinc-50/50 border-b text-[10px] font-black uppercase tracking-[0.2em]">
                      <tr><th className="p-10 w-24 text-center">선택</th><th className="p-10">컬렉션명</th><th className="p-10 text-right">개수</th><th className="p-10 text-center">보기</th></tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {collections.map(c => (
                        <tr key={c.id} className="hover:bg-blue-50/10 transition-colors">
                          <td className="p-10 text-center"><button onClick={() => toggleSelect(c.id, c.collection_code)}>{selectedCollections.some(s => s.id === c.id) ? <CheckSquare className="text-blue-600" size={24} /> : <Square className="text-zinc-100" size={24} />}</button></td>
                          <td className="p-10 font-black text-lg">{c.collection_name}</td>
                          <td className="p-10 text-right text-2xl font-black text-blue-600">{(c as any).collection_data_num || 0}</td>
                          <td className="p-10 text-center space-x-3">
                            <button onClick={() => router.push({ query: { ...router.query, collection_name: c.collection_name } }, undefined, { shallow: true })} className="px-8 py-3 text-[10px] font-black border-2 border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm uppercase tracking-widest">Inspect</button>
                            {!hasModel && <button onClick={() => { if (confirm('삭제?')) deleteCollections([{ id: c.id, code: c.collection_code }]) }} className="p-3.5 text-zinc-200 hover:text-red-500 rounded-xl active:scale-95 transition-all"><Trash2 size={22} /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 하단 일괄 작업 바 (분석 이동 보존) */}
              {selectedCollections.length > 0 && (
                <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-6">
                  <div className="bg-zinc-100/95 backdrop-blur-xl px-12 py-7 rounded-[3rem] shadow-3xl flex items-center gap-16 border border-white ring-[10px] ring-zinc-200/20 font-sans">
                    <div className="flex flex-col"><span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Batch Operations</span><p className="text-2xl font-black text-zinc-900 tracking-tighter"><span className="text-blue-600">{selectedCollections.length}</span> Selected</p></div>
                    <div className="flex gap-4 items-center">
                      <button onClick={() => setViewMode("stats")} className="bg-white text-zinc-900 px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-sm border border-zinc-200 transition-all hover:bg-zinc-50">View Stats</button>
                      <button onClick={() => {
                        const codes = selectedCollections.map(s => s.code).join(',');
                        router.push(`/project/${project_id}/collection/analysis?codes=${codes}`);
                      }} className="bg-zinc-900 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase shadow-2xl hover:bg-black transition-all flex items-center gap-3 active:scale-95"><Network size={16} /> Cluster Analysis</button>
                      <div className="w-[1px] h-10 bg-zinc-200 mx-4" />
                      <button onClick={() => setSelectedCollections([])} className="p-3 text-zinc-300 hover:text-red-500 transition-all"><X size={24} strokeWidth={3} /></button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {isAddModalOpen && <AddCollectionModal project_id={project_id as string} onClose={() => setIsAddModalOpen(false)} onSave={async (name) => { if (await addCollection(name)) loadAllData(); setIsAddModalOpen(false); }} />}
      {isActionLoading && <div className="fixed inset-0 z-[200] bg-zinc-900/20 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300"><div className="bg-white p-12 rounded-[3.5rem] shadow-3xl flex flex-col items-center"><Loader2 className="animate-spin text-blue-600 mb-8" size={64} strokeWidth={3} /><p className="font-black text-zinc-900 tracking-widest uppercase text-xs">Synchronizing...</p></div></div>}
    </ProjectLayout>
  );
}