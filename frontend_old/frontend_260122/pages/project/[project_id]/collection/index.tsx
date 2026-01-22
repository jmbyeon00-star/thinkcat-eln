// /frontend/pages/project/[project_id]/collection/index.tsx
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import Head from "next/head";
import {
  Folder, Search, ChevronLeft, ChevronRight,
  BarChart3, PieChart as PieChartIcon, Plus, XCircle, Loader2,
  Edit3, ChevronDown, ChevronUp, ArrowLeft, ArrowRight, FileText, BarChart2, Trash2, X
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";

import ProjectLayout from "@/components/layouts/ProjectLayout";
import AddCollectionModal from "@/components/collection/AddCollectionModal";
import { useCollectionActions } from "@/hooks/project/useCollectionActions";
import { withMessages } from '@/lib/i18n/withMessages';
import { CollectionInfo } from "@/types/collection";
import { ModelInfo } from "@/lib/types";

import SearchComponent from "@/components/project/SearchComponent";
import UploadComponent from "@/components/project/UploadComponent";

export const getServerSideProps = withMessages();

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A6', '#19FFD1', '#5B86E5', '#A52A2A', '#004D40'];
const getDynamicColor = (index: number) => {
  const hue = (index * 137.5) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

type PreviewItem = {
  pdid: number;
  application_number: string;
  title: string;
  abstract?: string;
  collection_name?: string;
};

// --- [컴포넌트: 통계 대시보드] ---
const StatsDashboard = ({ stats, chartToggle, setChartToggle, selectedGroup, setSelectedGroup, onProceed, canProceed }: any) => {
  const groupDistribution = stats?.group_distribution ?? {};
  console.log("1. groupDistribution:", groupDistribution)

  // 그룹 선택에 따른 동적 데이터 가공
  const currentChartData = useMemo(() => {
    if (selectedGroup === "all") {
      const totalMap: Record<string, { used: number; unused: number }> = {};
      Object.values(groupDistribution).flat().forEach((item: any) => {
        if (!totalMap[item.name]) totalMap[item.name] = { used: 0, unused: 0 };
        totalMap[item.name].used += item.used || 0;
        totalMap[item.name].unused += item.unused || 0;
      });
      return Object.entries(totalMap).map(([name, val]) => ({
        name,
        used: val.used,
        unused: val.unused,
        total: val.used + val.unused
      }));
    }
    return (groupDistribution[selectedGroup] || []).map((item: any) => ({
      ...item,
      total: item.total || item.used + item.unused,
      used: item.used || 0,
      unused: item.unused || 0,
      ratio: item.ratio || 0
    }));
  }, [groupDistribution, selectedGroup]);
  console.log("2. groupDistribution:", groupDistribution)

  // const currentTotalDocs = useMemo(() => currentChartData.reduce((acc, cur) => acc + cur.total, 0), [currentChartData]);
  // 76라인 수정
  const currentTotalDocs = useMemo(() =>
    currentChartData.reduce((acc: number, cur: { total: number }) => acc + cur.total, 0),
    [currentChartData]
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 필터 및 요약 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full md:w-auto">
          <div className="bg-white rounded-3xl p-6 border shadow-lg border-zinc-100 min-w-[240px]">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-50 rounded-lg"><FileText className="text-blue-600 w-4 h-4" /></div>
              <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-tighter">Current Group Total</h3>
            </div>
            <p className="text-3xl font-black text-zinc-900">{currentTotalDocs.toLocaleString()}</p>
          </div>
        </div>

        <div className="relative min-w-[300px] group">
          <label className="block text-xs font-bold text-zinc-400 mb-1.5 ml-1 uppercase">Group Filter</label>
          <div className="relative">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="w-full appearance-none bg-white border-2 border-zinc-200 text-zinc-700 py-3 px-4 pr-10 rounded-2xl focus:outline-none focus:border-blue-500 transition-all font-bold cursor-pointer shadow-sm"
            >
              <option value="all">전체 그룹 (All Groups)</option>
              {stats?.group_list?.map((g: any) => (
                <option key={g.code} value={g.code}>{g.code} ({g.total.toLocaleString()}건)</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" size={20} />
          </div>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <div className="bg-indigo-600 px-8 py-5 text-white font-bold flex justify-between items-center">
          <div className="flex items-center gap-2">
            {chartToggle === 'pie' ? <PieChartIcon size={20} /> : <BarChart2 size={20} />}
            <span>분석 결과: {selectedGroup === 'all' ? '전체 프로젝트' : selectedGroup}</span>
          </div>
          <div className="flex bg-white/10 p-1 rounded-xl">
            <button onClick={() => setChartToggle('pie')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartToggle === 'pie' ? 'bg-white text-zinc-900 shadow-md' : 'text-white/60 hover:text-white'}`}>원형</button>
            <button onClick={() => setChartToggle('bar')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartToggle === 'bar' ? 'bg-white text-zinc-900 shadow-md' : 'text-white/60 hover:text-white'}`}>막대</button>
          </div>
        </div>
        <div className="p-10 h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            {chartToggle === 'pie' ? (
              <PieChart>
                <Pie data={currentChartData} dataKey="total" cx="50%" cy="50%" outerRadius={150} innerRadius={80} paddingAngle={5} label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(1)}%)`}>
                  {currentChartData.map((_: any, i: number) => <Cell key={i} fill={getDynamicColor(i)} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={currentChartData} layout="vertical" margin={{ left: 40, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fontWeight: 'bold' }} />
                <Tooltip />
                <Legend verticalAlign="top" align="right" />
                <Bar dataKey="used" name="CORRECT" stackId="a" fill="#3b82f6" />
                <Bar dataKey="unused" name="COUNTER" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* 리스트 테이블 */}
      <div className="bg-white rounded-[2rem] border shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-50 border-b text-xs font-bold text-zinc-400 uppercase tracking-widest">
            <tr>
              <th className="px-8 py-4">컬렉션 명</th>
              <th className="px-8 py-4 text-right">CORRECT</th>
              <th className="px-8 py-4 text-right">COUNTER</th>
              <th className="px-8 py-4 text-right">전체 합계</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {currentChartData.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-8 py-5 font-bold text-zinc-700">{item.name}</td>
                <td className="px-8 py-5 text-right font-bold text-blue-600">{item.used.toLocaleString()}</td>
                <td className={`px-8 py-5 text-right font-bold ${item.unused > 0 ? 'text-red-500' : 'text-zinc-300'}`}>{item.unused.toLocaleString()}</td>
                <td className="px-8 py-5 text-right font-black text-zinc-900">{item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default function IntegratedProjectPage() {
  const router = useRouter();
  const { project_id, collection_name } = router.query;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const { data: session } = useSession() as { data: (Session & { access_token?: string }) | null };
  const token = session?.access_token;

  // --- UI 상태 ---
  const [viewMode, setViewMode] = useState<"grid" | "table" | "stats" | "preview">("table");
  const [chartToggle, setChartToggle] = useState<'pie' | 'bar'>('bar');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  // --- 데이터 상태 ---
  const [stats, setStats] = useState<any>(null);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [total, setTotal] = useState(0);
  const [totalDataNum, setTotalDataNum] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [selectedCollections, setSelectedCollections] = useState<{ id: number, code: string }[]>([]);
  const [showAddTool, setShowAddTool] = useState(false);

  // --- 편집 전용 상태 ---
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ row: number; key: keyof PreviewItem } | null>(null);
  const [modified, setModified] = useState<Record<number, Partial<PreviewItem>>>({});
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const perPage = 10;

  const hasModel = useMemo(() => Array.isArray(modelInfo) ? modelInfo.length > 0 : !!modelInfo, [modelInfo]);
  const isEditDisabled = hasModel;

  const loadAllData = useCallback(async () => {
    if (!project_id || !token) return;
    try {
      setLoading(true);
      // 컬렉션 정보 로드
      const res = await fetch(`${API_BASE}/api/project/${project_id}/collection?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setCollections(data.collection_info || []);
      setModelInfo(data.model_info);
      setTotal(data.total_collections || 0);
      setTotalDataNum(data.total_data_num || 0);

      // 통계 정보 로드 (그룹별 통계용)
      const resStats = await fetch(`${API_BASE}/api/project/${project_id}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataStats = await resStats.json();
      setStats(dataStats);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [project_id, token, page, limit, query, API_BASE]);

  const loadPreview = useCallback(async (targetName: string) => {
    if (!project_id || !token) return;
    try {
      setPreviewLoading(true);
      const res = await fetch(`${API_BASE}/api/project/${project_id}/preview`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const filtered = (data.items || []).filter((item: PreviewItem) => item.collection_name === targetName);
      setPreviewItems(filtered);
      setViewMode("preview");
    } catch (e) { alert("데이터 로드 실패"); } finally { setPreviewLoading(false); }
  }, [project_id, token, API_BASE]);

  useEffect(() => { loadAllData(); }, [loadAllData]);

  useEffect(() => {
    if (collection_name) loadPreview(collection_name as string);
    else if (viewMode === "preview") setViewMode("table");
  }, [collection_name, loadPreview]);

  // const { addCollection, deleteCollections, isActionLoading } = useCollectionActions(project_id as string, token, loadAllData);
  const { addCollection, deleteCollections, isActionLoading } = useCollectionActions(
    project_id as string,
    token as string, // 또는 (token ?? "")
    loadAllData
  );

  // --- 핸들러 ---
  const handleAnalyze = () => {
    if (selectedCollections.length === 0) return alert("컬렉션을 선택해주세요.");
    const codes = selectedCollections.map(s => s.code).join(',');
    router.push(`/project/${project_id}/collection/analysis?codes=${codes}`);
  };

  const handleProceedTrain = () => {
    const minCount = 5;
    const invalid = (stats?.collection_info || []).filter((c: any) => (c.collection_data_num ?? 0) < minCount);
    if (invalid.length > 0) {
      alert(`데이터가 부족한 컬렉션이 있습니다.\n${invalid.map((i: any) => i.collection_name).join(', ')}`);
      return;
    }
    router.push(`/project/train/${project_id}`);
  };

  const handleEditClick = (name: string) => {
    router.push({ query: { ...router.query, collection_name: name } }, undefined, { shallow: true });
  };

  const handleBackToList = () => {
    const { collection_name, ...restQuery } = router.query;
    router.push({ query: restQuery }, undefined, { shallow: true });
    setModified({});
  };

  const toggleSelect = (id: number, code: string) => {
    setSelectedCollections(prev => prev.some(s => s.id === id) ? prev.filter(s => s.id !== id) : [...prev, { id, code }]);
  };

  const handleDeleteOne = async (id: number, code: string, name: string) => {
    if (isEditDisabled) return;
    if (!confirm(`'${name}' 컬렉션을 삭제하시겠습니까?`)) return;
    await deleteCollections([{ id, code }]);
  };

  const renderPreviewView = () => {
    const currentTarget = collection_name as string;
    const sourceType = stats?.project_info?.source_type;

    const pagedItems = previewItems.slice((previewPage - 1) * perPage, previewPage * perPage);
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <button onClick={handleBackToList} className="flex items-center gap-2 text-zinc-500 hover:text-blue-600 font-bold transition-all">
            <ArrowLeft size={18} /> 목록으로
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowAddTool(!showAddTool)}
              className={`px-6 py-2.5 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg ${showAddTool
                ? 'bg-zinc-200 text-zinc-600'
                : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                }`}
            >
              {showAddTool ? <X size={18} /> : <Plus size={18} />}
              {sourceType === 'search' ? '검색' : '파일 추가'}
            </button>
          </div>
        </div>

        {showAddTool && (
          <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-2xl animate-in slide-in-from-top-4 duration-300">
            {sourceType === 'search' ? (
              <SearchComponent
                project={stats?.project_info}
                token={token!}
                collections={collections}
                shouldUseCounter={stats?.project_info?.is_counter_used ?? false}
                fixedCollectionName={currentTarget} // 👈 현재 컬렉션명 고정
                trainingDataItems={previewItems}
                onTrainingDataUpdate={(newItems) => {
                  // 1. 화면에 보이는 리스트에 즉시 반영
                  setPreviewItems(prev => [...newItems, ...prev]);
                  // 2. 저장 대상(modified)에 마킹 (ID가 없으면 타임스탬프 활용)
                  newItems.forEach(item => {
                    const key = item.pdid || `new_${Date.now()}_${Math.random()}`;
                    setModified(prev => ({ ...prev, [key]: item }));
                  });
                }}
                onCounterDataUpdate={() => { /* 필요 시 카운터 로직 추가 */ }}
              />
            ) : (
              <UploadComponent
                project={stats?.project_info}
                token={token!}
                collections={collections}
                fixedCollectionName={currentTarget}
                // onTrainingDataUpdate={(newItems) => {
                //   setPreviewItems(prev => [...newItems, ...prev]);
                //   newItems.forEach(item => {
                //     const key = item.pdid || `new_${Date.now()}_${Math.random()}`;
                //     setModified(prev => ({ ...prev, [key]: item }));
                //   });
                // }}
                onTrainingDataUpdate={(newItems) => {
                  const mappedItems: PreviewItem[] = newItems.map((item: any) => ({
                    pdid: item.pdid || item.id || 0, // 필수값인 pdid를 확보
                    application_number: item.application_number || "",
                    title: item.title || "",
                    abstract: item.abstract || "",
                    collection_name: currentTarget
                  }));
                  setPreviewItems(prev => [...mappedItems, ...prev]);
                  mappedItems.forEach(item => {
                    const key = item.pdid || `new_${Date.now()}_${Math.random()}`;
                    setModified(prev => ({ ...prev, [key]: item }));
                  });
                }}
              />
            )}
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b text-zinc-400 font-bold uppercase text-[11px] tracking-widest">
              <tr>
                <th className="p-5 w-16 text-center">#</th>
                <th className="p-5 w-48">컬렉션 명</th>
                <th className="p-5">특허명</th>
                <th className="p-5 w-20 text-center">상세</th>
                <th className="p-5 w-20 text-center">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50 text-sm">
              {pagedItems.length > 0 ? (
                pagedItems.map((item, idx) => {
                  // 실제 데이터 상의 인덱스 계산
                  const realIdx = (previewPage - 1) * perPage + idx;
                  const isModified = !!modified[item.pdid];

                  return (
                    <React.Fragment key={item.pdid || `new-${idx}`}>
                      <tr className={`hover:bg-blue-50/30 transition-colors ${isModified ? 'bg-yellow-50/50' : ''}`}>
                        <td className="p-5 text-center text-zinc-300 font-mono">{realIdx + 1}</td>
                        <td className="p-5 font-bold text-blue-600">{item.collection_name}</td>
                        <td className="p-5" onClick={() => !isEditDisabled && setEditingCell({ row: realIdx, key: 'title' })}>
                          {editingCell?.row === realIdx && editingCell.key === 'title' ? (
                            <input
                              autoFocus
                              className="w-full border-2 border-blue-500 rounded-lg px-2 py-1 outline-none font-bold"
                              value={item.title}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPreviewItems(prev => prev.map((it, i) => i === realIdx ? { ...it, title: val } : it));
                                setModified(prev => ({ ...prev, [item.pdid]: { ...prev[item.pdid], title: val } }));
                              }}
                              onBlur={() => setEditingCell(null)}
                            />
                          ) : (
                            <span className="block truncate max-w-lg text-zinc-700 font-medium cursor-pointer hover:text-blue-600 transition-colors">
                              {item.title}
                            </span>
                          )}
                        </td>
                        {/* 상세보기 토글 버튼 */}
                        <td className="p-5 text-center">
                          <button
                            onClick={() => setExpandedRow(expandedRow === realIdx ? null : realIdx)}
                            className="text-zinc-400 hover:text-zinc-600"
                          >
                            {expandedRow === realIdx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </button>
                        </td>
                        {/* 🚀 행 삭제 버튼 추가 */}
                        <td className="p-5 text-center">
                          <button
                            disabled={isEditDisabled}
                            onClick={() => {
                              if (confirm("이 데이터를 목록에서 제거하시겠습니까? (저장 시 최종 반영)")) {
                                setPreviewItems(prev => prev.filter((_, i) => i !== realIdx));
                                // 삭제된 경우 modified에서도 해당 키 제거 (선택 사항)
                                const nextModified = { ...modified };
                                delete nextModified[item.pdid];
                                setModified(nextModified);
                              }
                            }}
                            className="text-zinc hover:text-red-500 cursor-pointer transition-all active:scale-90 disabled:opacity-30"
                          >
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>

                      {/* 확장된 요약문 수정 영역 */}
                      {expandedRow === realIdx && (
                        <tr className="bg-zinc-50/50 animate-in fade-in duration-200">
                          <td colSpan={5} className="p-8"> {/* 🚀 colSpan을 5로 조정 */}
                            <div className="bg-white p-6 rounded-2xl border shadow-inner border-zinc-200">
                              <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-zinc-400 flex items-center gap-2">
                                  <Edit3 size={14} /> 요약문
                                </p>
                                {isModified && <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">변경됨</span>}
                              </div>
                              <textarea
                                readOnly={isEditDisabled}
                                className="w-full h-40 p-4 border rounded-xl focus:ring-4 focus:ring-blue-50 outline-none transition-all text-sm leading-relaxed text-zinc-600"
                                value={item.abstract || ""}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setPreviewItems(prev => prev.map((it, i) => i === realIdx ? { ...it, abstract: val } : it));
                                  setModified(prev => ({ ...prev, [item.pdid]: { ...prev[item.pdid], abstract: val } }));
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="p-20 text-center text-zinc-400 font-medium">표시할 데이터가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>

          {/* 페이지네이션 하단 */}
          <div className="p-6 bg-zinc-50 border-t flex justify-center items-center gap-6">
            <button
              disabled={previewPage === 1}
              onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
              className="p-2.5 border rounded-xl bg-white hover:bg-zinc-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-1.5 font-black text-sm">
              <span className="text-blue-600">{previewPage}</span>
              <span className="text-zinc-300">/</span>
              <span className="text-zinc-700">{Math.max(1, Math.ceil(previewItems.length / perPage))}</span>
            </div>
            <button
              disabled={previewPage * perPage >= previewItems.length}
              onClick={() => setPreviewPage(p => p + 1)}
              className="p-2.5 border rounded-xl bg-white hover:bg-zinc-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
      <Head><title>Integrated Dashboard | IPFORCE</title></Head>
      <div className="min-h-screen bg-zinc-50/50 p-8">
        <div className="max-w-7xl mx-auto">

          <div className="flex justify-between items-end mb-10">
            <div><h1 className="text-3xl font-black text-zinc-900 tracking-tight">컬렉션</h1><p className="text-zinc-500 font-medium ml-4 font-mono">Project: #{project_id}</p></div>
            <div className="flex bg-white p-1.5 rounded-2xl border shadow-sm">
              <button onClick={() => { setViewMode("table"); handleBackToList(); }} className={`px-5 py-2 rounded-xl text-sm font-bold transition ${viewMode === 'table' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400'}`}>목록</button>
              <button onClick={() => { setViewMode("grid"); handleBackToList(); }} className={`px-5 py-2 rounded-xl text-sm font-bold transition ${viewMode === 'grid' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400'}`}>카드</button>
              <button onClick={() => { setViewMode("stats"); handleBackToList(); }} className={`px-5 py-2 rounded-xl text-sm font-bold transition ${viewMode === 'stats' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-400'}`}>통계</button>
            </div>
          </div>

          {loading || previewLoading ? (
            <div className="py-40 text-center animate-pulse"><Loader2 className="w-12 h-12 animate-spin mx-auto text-blue-600 mb-4" /><p className="font-black text-zinc-400 text-xs uppercase tracking-widest">Synchronizing...</p></div>
          ) : viewMode === "preview" ? (
            renderPreviewView()
          ) : viewMode === "stats" ? (
            <StatsDashboard
              stats={stats}
              totalDocs={totalDataNum}
              hasModel={hasModel}
              chartToggle={chartToggle}
              setChartToggle={setChartToggle}
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              onProceed={handleProceedTrain}
              canProceed={collections.length > 0}
            />
          ) : (
            <>
              {hasModel && <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-sm font-bold flex items-center gap-2"><XCircle size={20} /> 모델 존재로 컬렉션 관리 및 수정이 제한됩니다.</div>}

              <div className="flex flex-col md:flex-row gap-4 mb-10">
                <div className="relative flex-1 group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-300" />
                  <input className="w-full bg-white border border-zinc-200 rounded-2xl pl-12 pr-4 py-4 shadow-sm outline-none focus:ring-4 focus:ring-blue-50 transition-all" placeholder="컬렉션 검색..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  {!isEditDisabled && <button onClick={() => setIsAddModalOpen(true)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl hover:bg-blue-700 transition flex items-center gap-2"><Plus size={20} /> 추가</button>}
                  {selectedCollections.length > 0 && <button onClick={handleAnalyze} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2"><BarChart3 size={20} /> 분석 ({selectedCollections.length})</button>}
                </div>
              </div>

              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in">
                  {collections.map(c => (
                    <div key={c.id} className={`group bg-white p-8 rounded-[2.5rem] border-2 transition-all cursor-pointer relative ${selectedCollections.some(s => s.id === c.id) ? 'border-blue-500 ring-4 ring-blue-50 shadow-2xl' : 'border-transparent hover:shadow-xl hover:border-zinc-100'}`} onClick={() => router.push(`/project/${project_id}/collection/${c.id}`)}>
                      <div className="flex justify-between items-start mb-8">
                        <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm"><Folder size={28} /></div>
                        <div className="flex flex-col items-end gap-3">
                          <button onClick={(e) => { e.stopPropagation(); handleEditClick(c.collection_name); }} className="bg-zinc-100 text-zinc-500 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1"><Edit3 size={12} /> 편집</button>
                          <div className="flex items-center gap-2 bg-zinc-50 px-3 py-1.5 rounded-lg border">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-tighter">Select</span>
                            <input type="checkbox" className="w-5 h-5 rounded-md accent-blue-600 cursor-pointer shadow-sm border-zinc-300" checked={selectedCollections.some(s => s.id === c.id)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => toggleSelect(c.id, c.collection_code)} />
                          </div>
                        </div>
                      </div>
                      <h3 className="text-xl font-black text-zinc-900 mb-2 truncate tracking-tight">{c.collection_name}</h3>
                      <p className="text-sm font-mono text-zinc-300 mb-10 tracking-tighter">{c.collection_code}</p>
                      <div className="flex justify-between items-center pt-6 border-t border-zinc-50">
                        <span className="text-2xl font-black text-blue-600">{((c as any).collection_data_num + ((c as any).counter_data_num || 0)).toLocaleString()} <small className="text-zinc-400 font-normal text-xs uppercase">Items</small></span>
                        <ArrowRight className="text-zinc-200 group-hover:text-blue-600 transition-colors" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] border shadow-xl overflow-hidden border-zinc-100 text-sm">
                  <table className="w-full text-left">
                    <thead className="bg-zinc-50 border-b text-xs font-bold text-zinc-400 uppercase tracking-widest">
                      <tr>
                        <th className="p-6 w-12 text-center"><input type="checkbox" onChange={() => { if (selectedCollections.length === collections.length) setSelectedCollections([]); else setSelectedCollections(collections.map(c => ({ id: c.id, code: c.collection_code }))); }} checked={collections.length > 0 && selectedCollections.length === collections.length} className="w-5 h-5 accent-blue-600" /></th>
                        <th className="p-6">컬렉션 정보</th><th className="p-6 text-right">데이터 건수</th><th className="p-6 text-center">동작</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {collections.map(c => (
                        <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-6 text-center"><input type="checkbox" checked={selectedCollections.some(s => s.id === c.id)} onChange={() => toggleSelect(c.id, c.collection_code)} className="w-5 h-5 accent-blue-600" /></td>
                          <td className="p-6 cursor-pointer" onClick={() => router.push(`/project/${project_id}/collection/${c.id}`)}>
                            <p className="font-bold text-zinc-800 hover:text-blue-600 transition-colors">{c.collection_name}</p>
                            <p className="text-xs font-mono text-zinc-300">{c.collection_code}</p>
                          </td>
                          <td className="p-6 text-right font-black text-blue-600 text-lg">{((c as any).collection_data_num + ((c as any).counter_data_num || 0)).toLocaleString()}</td>
                          <td className="p-6 text-center space-x-2">
                            <button onClick={() => handleEditClick(c.collection_name)} className="px-5 py-2 text-xs font-bold border-2 rounded-xl hover:bg-blue-600 hover:text-white transition-all hover:border-blue-600 shadow-sm">편집</button>
                            {!isEditDisabled && <button onClick={() => handleDeleteOne(c.id, c.collection_code, c.collection_name)} className="p-2.5 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {!loading && total > limit && viewMode !== "stats" && viewMode !== "preview" && (
            <div className="mt-16 flex justify-center items-center gap-4">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="w-14 h-14 border-2 rounded-2xl bg-white flex items-center justify-center hover:shadow-xl disabled:opacity-30 transition-all"><ChevronLeft size={20} /></button>
              <div className="bg-white px-8 py-3 rounded-2xl border-2 font-black shadow-sm text-zinc-700">{page} <span className="text-zinc-200 mx-2">/</span> {Math.ceil(total / limit)}</div>
              <button disabled={page * limit >= total} onClick={() => setPage(p => p + 1)} className="w-14 h-14 border-2 rounded-2xl bg-white flex items-center justify-center hover:shadow-xl disabled:opacity-30 transition-all"><ChevronRight size={20} /></button>
            </div>
          )}
        </div>
      </div>

      {isActionLoading && (<div className="fixed inset-0 z-[100] bg-zinc-900/10 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in"><div className="bg-white p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center"><Loader2 className="w-12 h-12 animate-spin text-blue-600 mb-4" /><p className="font-black text-zinc-800 tracking-tight">데이터 처리 중입니다</p></div></div>)}

      {isAddModalOpen && (
        <AddCollectionModal
          project_id={project_id as string}
          onClose={() => setIsAddModalOpen(false)}
          onSave={async (name: string) => {
            // 1. 현재 목록(collections)에서 같은 이름이 있는지 확인
            const isDuplicate = collections.some(c => c.collection_name.trim() === name.trim());
            if (isDuplicate) {
              alert(`'${name}'은(는) 이미 존재하는 컬렉션 이름입니다.`);
              return; // 중복이면 서버에 요청을 보내지 않고 함수 종료
            }

            // 2. 중복이 아닐 때만 서버 요청 보냄
            const success = await addCollection(name);
            if (success) {
              loadAllData();
              setIsAddModalOpen(false);
            }

          }}
        />)}
    </ProjectLayout>
  );
}