import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CheckSquare, ChevronUp, ChevronDown, Sparkles, ShoppingCart, BarChart3, Plus, Save, Square, X, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import ModelProgressSSE from "@/components/ModelProgressSSE";
import { CollectionInfo } from "@/types/collection";

// AI 추천 모델 패널
export default function RecommendationPanel({
    collection,
    dataItems,
    setDataItems,
    token
}: {
    collection: CollectionInfo;
    dataItems: any[];
    setDataItems: React.Dispatch<React.SetStateAction<any[]>>;
    token?: string;
}) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const { isBusy, progress: storeProgress, status: storeStatus, setState } = useUserTaskStore();

    // 상태 관리
    const [params, setParams] = useState({ epoch: 5, batch_size: 128, learning_rate: 1e-5, max_length: 256, shuffle: true, length: 500 });
    const [hasTrainedModel, setHasTrainedModel] = useState(0);
    const [modelInfo, setModelInfo] = useState<{ id: number; progress: number; model_version: number; model_status?: number } | null>(null);
    const [inferenceResults, setInferenceResults] = useState<any[]>([]);
    const [histories, setHistories] = useState<{ train_acc: []; valid_acc: []; train_loss: []; valid_loss: []; } | null>(null);

    // 추천 UI 제어 상태
    const [showMetrics, setShowMetrics] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [resultPage, setResultPage] = useState(1);
    const [resultLimit, setResultLimit] = useState(10);

    async function fetchRecommendationResult(modelId: number) {
        try {
            const res = await fetch(`${API_BASE}/api/ai/recommendation/result/${modelId}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
            });
            if (!res.ok) throw new Error("추천 결과를 불러오지 못했습니다.");
            const data = await res.json();

            setInferenceResults(data.results || []);
            setHistories(data.histories || null);
        } catch (err) {
            console.error(err);
        }
    }

    async function handleTrainRecommendation() {
        setState({ isBusy: true, status: hasTrainedModel ? "RUNNING" : "INFERRING", progress: 0 });

        try {
            const res = await fetch(`${API_BASE}/api/ai/recommend/${collection.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({
                    run_type: "train",
                    data_scope: "collection",
                    task_type: "recommendation",
                    source_type: collection.source_type,
                    collection_name: collection.collection_name,
                    collection_code: collection.collection_code,
                    collection_num: 1,
                    model_name: `${collection?.collection_name} 추천 모델`,
                    project_name: collection.project_name?.[0] ?? "추천 테스트",
                    ...params,
                }),
            });
            const data = await res.json();

            if (data.model_id) {
                setModelInfo({
                    id: data.model_id,
                    progress: 0,
                    model_version: data.model_version ?? 0,
                    model_status: 0
                });
                setHasTrainedModel(data.model_version);
            }

        } catch (err) {
            alert(err);
            console.error(err)
            setState({ isBusy: false, status: 'AVAILABLE' });
        }
    }

    useEffect(() => {
        async function checkModel() {
            if (!collection || !token) return;
            try {
                const res = await fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });
                const data = await res.json();

                setHasTrainedModel(data.model_version);
                setModelInfo({
                    id: data.model_info.id,
                    progress: data.model_info.progress,
                    model_version: data.model_version,
                    model_status: data.model_info.model_status
                });

                // 이미 완료된 모델이면 결과 로드
                // if (data.model_info?.model_status === 1 && data.model_info.progress === -1) {
                //     fetchRecommendationResult(data.model_info.id);
                // }

                // 재학습시 기존 하이퍼 파라미터값 적용(고정)
                if (data.model_info && Object.keys(data.model_info).length > 0) {
                    setParams((prev) => ({
                        ...prev,
                        // epoch: data.model_info.epoch,
                        // batch_size: data.model_info.batch_size,
                        learning_rate: data.model_info.learning_rate,
                        // max_length: data.model_info.max_length,
                        shuffle: data.model_info.shuffle,
                    }));
                }
            } catch (e) { console.warn("Initial check failed", e); }
        }
        checkModel();
    }, [collection.collection_code, token, hasTrainedModel]); // token, hasTrainedModel 제외 '컬렉션 코드'가 바뀔 때만 실행

    console.log(">>> cartItems:", cartItems)

    // 2. SSE를 통한 실시간 완료 감지 (별도 분리)
    useEffect(() => {
        if (storeProgress === -1 && modelInfo?.id) {
            const timer = setTimeout(async () => {
                try {

                    await fetchRecommendationResult(modelInfo.id);
                    setState({ isBusy: false, status: 'AVAILABLE', progress: 0 });
                } catch (e) {
                    console.error("결과 로드 실패, 재시도 필요");

                }
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [storeProgress, modelInfo?.id]);

    // 추천 목록 처리
    const finalFilteredResults = inferenceResults.filter(r => {

        // 1. 이미 컬렉션 리스트(dataItems)에 있는지 확인
        // const isAlreadyInCollection = dataItems.some(item => item.application_number === r.application_number);
        const isAlreadyInCollection = dataItems.some(item => String(item.application_number) === String(r.application_number));
        // 2. 현재 장바구니(cartItems)에 담겨 있는지 확인
        // const isAlreadyInCart = cartItems.some(cart => cart.application_number === r.application_number);
        const isAlreadyInCart = cartItems.some(cart => String(cart.application_number) === String(r.application_number));

        return !isAlreadyInCollection && !isAlreadyInCart;
    });

    const [expandedRow, setExpandedRow] = useState<string | null>(null);
    // 추천 목록 바구니 페이지네이션
    const totalPages = Math.ceil(finalFilteredResults.length / resultLimit);
    const pagedResults = finalFilteredResults.slice((resultPage - 1) * resultLimit, resultPage * resultLimit);
    // const availablePagedIds = pagedResults.filter(r => !cartItems.some(cart => cart.application_number === r.application_number)).map(r => String(r.application_number));
    const availablePagedIds = pagedResults.map(r => String(r.application_number));
    const isAllSelected = availablePagedIds.length > 0 && availablePagedIds.every(id => selectedIds.has(id));

    const toggleSelect = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const toggleSelectAll = () => {
        const next = new Set(selectedIds);
        if (isAllSelected) {
            // 현재 페이지 항목만 선택 해제
            availablePagedIds.forEach(id => next.delete(id));
        } else {
            // 현재 페이지 항목 모두 추가
            availablePagedIds.forEach(id => next.add(id));
        }
        setSelectedIds(next);
    };

    const addSelectedToCart = () => {
        const toAdd = inferenceResults.filter(r => selectedIds.has(String(r.application_number)));
        setCartItems(prev => {
            const existingIds = new Set(prev.map(i => String(i.application_number)));
            return [...prev, ...toAdd.filter(a => !existingIds.has(String(a.application_number)))];
        });
        setSelectedIds(new Set());
    };

    async function handleSubmitCart() {
        if (!confirm(`${cartItems.length}개를 등록하시겠습니까?`)) return;
        console.log(">>> collection:", collection)
        try {
            const itemsToSave = cartItems.map(item => ({ ...item, collection_id: collection.id, project_id: collection.project_id, project_code: collection.project_code, source_type: collection.source_type, used: 1 }));
            const res = await fetch(`${API_BASE}/api/collection/${collection.id}/${collection.project_id}/save`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                body: JSON.stringify({ items: itemsToSave }),
            });

            if (res.ok) {
                alert("저장 성공!");
                setDataItems(prev => [...prev, ...itemsToSave]);
                setCartItems([]);
                setSelectedIds(new Set());
            }
        } catch (e) { alert("저장 실패"); }
    }

    return (
        <section className="space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-semibold text-white">AI 추천 모델</h2>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* [기존 유지] 학습 파라미터 */}
                    {/* {!hasTrainedModel && ( */}
                    {histories?.train_acc && histories.train_acc.length > 0 && (
                        <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-xl p-6 border border-zinc-200">
                            <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                                학습 파라미터
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-700 mb-2">Epoch</span>
                                    <input
                                        type="number"
                                        value={params.epoch}
                                        onChange={(e) => setParams({ ...params, epoch: Number(e.target.value) })}
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        disabled={isBusy}
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-700 mb-2">Batch Size</span>
                                    <input
                                        type="number"
                                        value={params.batch_size}
                                        onChange={(e) => setParams({ ...params, batch_size: Number(e.target.value) })}
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        disabled={isBusy}
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-700 mb-2">Learning Rate</span>
                                    <input
                                        type="number"
                                        step="0.00001"
                                        value={params.learning_rate}
                                        onChange={(e) => setParams({ ...params, learning_rate: parseFloat(e.target.value) })}
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        disabled={isBusy}
                                    />
                                </label>
                                <label className="flex flex-col">
                                    <span className="text-sm font-medium text-zinc-700 mb-2">Max Length</span>
                                    <input
                                        type="number"
                                        value={params.max_length}
                                        onChange={(e) => setParams({ ...params, max_length: Number(e.target.value) })}
                                        className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                        disabled={isBusy}
                                    />
                                </label>
                            </div>

                            <div className="flex items-center gap-6 mt-4">
                                <span className="text-sm font-medium text-zinc-700">Shuffle</span>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="shuffle"
                                        checked={params.shuffle === true}
                                        onChange={() => setParams({ ...params, shuffle: true })}
                                        className="w-4 h-4 text-blue-600"
                                        disabled={isBusy}
                                    />
                                    <span className="text-sm text-zinc-700">On</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="shuffle"
                                        checked={params.shuffle === false}
                                        onChange={() => setParams({ ...params, shuffle: false })}
                                        className="w-4 h-4 text-blue-600"
                                        disabled={isBusy}
                                    />
                                    <span className="text-sm text-zinc-700">Off</span>
                                </label>
                            </div>
                        </div>


                    )}

                    {/* 📊 [통합] Accuracy & Loss 차트 */}
                    {hasTrainedModel > 0 && histories?.train_acc && (
                        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
                            <div className="bg-zinc-50 px-6 py-4 flex items-center justify-between cursor-pointer border-b" onClick={() => setShowMetrics(!showMetrics)}>
                                <div className="flex items-center gap-2 font-bold text-zinc-800"><BarChart3 size={18} className="text-blue-600" /> 학습 지표 분석 (Metrics)</div>
                                {showMetrics ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>
                            {showMetrics && (
                                <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in slide-in-from-top-2 transition-all">
                                    <div className="space-y-2"><span className="text-[10px] font-black text-emerald-600 uppercase px-1">Accuracy Trend</span>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={histories.train_acc.map((v: any, i: number) => ({ epoch: i + 1, t: v * 100, v: histories.valid_acc[i] * 100 }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="epoch" hide /><YAxis fontSize={10} domain={[0, 100]} /><Tooltip />
                                                <Line type="monotone" dataKey="t" stroke="#3b82f6" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="space-y-2"><span className="text-[10px] font-black text-orange-600 uppercase px-1">Loss Trend</span>
                                        <ResponsiveContainer width="100%" height={180}>
                                            <LineChart data={histories.train_loss.map((v: any, i: number) => ({ epoch: i + 1, t: v, v: histories.valid_loss[i] }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="epoch" hide /><YAxis fontSize={10} /><Tooltip />
                                                <Line type="monotone" dataKey="t" stroke="#f97316" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 추천 제어 버튼 */}
                    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6">
                        {isBusy ? (
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-bold text-blue-600"><span>{storeStatus === "RUNNING" ? "모델 학습 중..." : "추천 생성 중..."}</span><span>{storeProgress}%</span></div>
                                {modelInfo?.id && <ModelProgressSSE targetId={modelInfo.id} initialProgress={storeProgress} setValue={(p) => setState({ progress: p })} />}
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <p className="text-zinc-500 text-sm">데이터가 갱신되었다면 AI 추천을 다시 실행하세요.</p>
                                <button onClick={handleTrainRecommendation} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg"><Zap size={18} fill="white" />추천 받기</button>
                            </div>
                        )}
                    </div>

                    {/* 바구니 섹션 */}
                    {cartItems.length > 0 && (
                        <div className="mt-8 bg-white rounded-3xl border-2 border-blue-600 p-8 shadow-2xl animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-600 p-3 rounded-2xl text-white"><ShoppingCart size={24} /></div>
                                    <div><h3 className="font-black text-2xl text-zinc-900">등록 대기 바구니</h3><p className="text-sm text-blue-600 font-bold">{cartItems.length}건 선택됨</p></div>
                                </div>
                                <button onClick={handleSubmitCart} className="bg-zinc-900 hover:bg-black text-white px-10 py-4 rounded-2xl font-black shadow-xl flex items-center gap-3 transition-all">
                                    <Save size={20} /> 저장하기
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-4 bg-zinc-50 rounded-xl border">
                                {cartItems.map(item => (
                                    <div key={item.application_number} className="bg-white border border-zinc-200 px-3 py-2 rounded-xl flex items-center gap-4 shadow-sm group">
                                        <span className="text-xs font-bold text-zinc-700 truncate max-w-[200px]">{item.title}</span>

                                        <button
                                            onClick={() => setCartItems(prev => prev.filter(i => i.application_number !== item.application_number))}
                                            className="text-zinc-300 hover:text-red-500 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 추천 리스트 */}
                    {inferenceResults.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                            <div className="bg-zinc-100 px-6 py-4 flex justify-between items-center border-b border-zinc-200">
                                <div className="flex items-center gap-2 text-zinc-800 font-bold">
                                    <Sparkles size={18} className="text-blue-600" /> 추천 후보 목록
                                </div>
                                <button onClick={addSelectedToCart} disabled={selectedIds.size === 0} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-30 flex items-center gap-2">
                                    <Plus size={14} /> 바구니에 담기 ({selectedIds.size})
                                </button>
                            </div>
                            <table className="w-full text-sm table-fixed"> {/* 🚀 table-fixed 추가: 컬럼 너비 고정 */}
                                <thead className="bg-zinc-100 text-zinc-500 border-b border-zinc-200">
                                    <tr className="text-left">
                                        <th className="p-4 w-16 text-center"> {/* 🚀 너비 고정 */}
                                            <button onClick={toggleSelectAll} disabled={availablePagedIds.length === 0} className="disabled:opacity-20">
                                                {isAllSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                                            </button>
                                        </th>
                                        <th className="p-4 font-bold text-zinc-700 w-1/4">특허명</th> {/* 🚀 너비 배분 */}
                                        <th className="p-4 font-bold text-zinc-700">요약문</th>
                                        <th className="p-4 font-bold text-zinc-700">분류</th>
                                        <th className="p-4 text-center font-bold text-zinc-700 w-24">유사도</th> {/* 🚀 너비 고정 */}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100">
                                    {pagedResults.map(r => {
                                        const isInCart = cartItems.some(cart => cart.application_number === r.application_number);
                                        const isSelected = selectedIds.has(String(r.application_number));
                                        const isExpanded = expandedRow === String(r.application_number);

                                        // 🚀 <group> 대신 <React.Fragment> 사용 (중요)
                                        return (
                                            <React.Fragment key={r.application_number}>
                                                {/* 메인 행 */}
                                                <tr
                                                    onClick={() => setExpandedRow(isExpanded ? null : String(r.application_number))}
                                                    className={`
                                                        transition-all cursor-pointer border-l-4
                                                        ${isSelected ? 'bg-blue-50/40 border-l-blue-600' : 'border-l-transparent'} 
                                                        ${isInCart ? 'bg-zinc-50 opacity-50' : 'hover:bg-zinc-50/80'}
                                                        ${isExpanded ? 'bg-blue-50/20' : ''}
                                                    `}
                                                >
                                                    {/* 1. 체크박스 */}
                                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected || isInCart}
                                                            onChange={() => toggleSelect(String(r.application_number))}
                                                            disabled={isInCart}
                                                            className={`w-5 h-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 ${isInCart ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                        />
                                                    </td>

                                                    {/* 2. 특허명 */}
                                                    <td className="p-4 vertical-top">
                                                        <div className={`font-bold transition-all ${isInCart ? 'text-zinc-400' : 'text-zinc-900'} ${isExpanded ? '' : 'line-clamp-1'}`}>
                                                            {r.title}
                                                            {isInCart && <span className="ml-2 text-[10px] bg-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase">담김</span>}
                                                        </div>
                                                        <div className="text-[11px] text-zinc-400 mt-1 truncate">{r.applicant_name}</div>
                                                    </td>

                                                    {/* 3. 요약문 (말줄임표) */}
                                                    <td className="p-4">
                                                        {/* <div className={`text-zinc-600 leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}> */}
                                                        <div className={`text-zinc-600 leading-relaxed transition-all line-clamp-2`}>
                                                            {r.abstract || "요약 정보가 없습니다."}
                                                        </div>
                                                    </td>

                                                    {/* 4. 분류 결과 */}
                                                    <td className="p-4">
                                                        <div className={`text-zinc-600 leading-relaxed transition-all`}>
                                                            {r.pred_label || "예측 정보가 없습니다."}
                                                        </div>
                                                    </td>


                                                    {/* 5. 유사도 */}
                                                    <td className="p-4 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-black text-purple-600">{(r.confidence * 100).toFixed(1)}%</span>
                                                            {isExpanded ? <ChevronUp size={14} className="text-zinc-400" /> : <ChevronDown size={14} className="text-zinc-400" />}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* 5. [확장 영역] 상세 정보 - 별도의 행으로 구성 */}
                                                {isExpanded && (
                                                    <tr className="bg-zinc-50/50">
                                                        <td colSpan={4} className="p-0"> {/* 🚀 colSpan 4 확인 */}
                                                            <div className="px-16 py-6 border-b border-zinc-100 animate-in fade-in slide-in-from-top-1 duration-200">
                                                                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                                                                    <div className="flex items-center gap-2 mb-4 text-blue-600">
                                                                        <span className="text-xs font-black uppercase tracking-widest">요약문</span>
                                                                    </div>
                                                                    <p className="text-sm leading-8 text-zinc-700 whitespace-pre-wrap">
                                                                        {r.abstract}
                                                                    </p>
                                                                    <div className="mt-6 pt-6 border-t border-zinc-100 grid grid-cols-2 gap-4">
                                                                        <div>
                                                                            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">출원 번호</span>
                                                                            <p className="text-xs font-mono font-bold text-zinc-600">{r.application_number}</p>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-[10px] text-zinc-400 font-black uppercase tracking-tighter">예측 상태</span>
                                                                            <p className="text-xs font-bold text-zinc-600">{r.pred_label || "N/A"}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* 🚀 3. [추가] 페이지네이션 컨트롤러 */}
                            <div className="bg-zinc-50 px-6 py-4 flex items-center justify-between border-t border-zinc-100">
                                {/* 페이지당 개수 설정 */}
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <span>보기:</span>
                                    <select
                                        value={resultLimit}
                                        onChange={(e) => { setResultLimit(Number(e.target.value)); setResultPage(1); }}
                                        className="bg-white border rounded px-2 py-1 outline-none focus:border-blue-500"
                                    >
                                        {[10, 20, 50].map(val => <option key={val} value={val}>{val}개씩</option>)}
                                    </select>
                                </div>

                                {/* 페이지 이동 버튼 */}
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setResultPage(prev => Math.max(1, prev - 1))}
                                        disabled={resultPage === 1}
                                        className="p-2 rounded-lg hover:bg-white border disabled:opacity-30 transition-all"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    <span className="text-sm font-bold text-zinc-700">
                                        <span className="text-blue-600">{resultPage}</span> / {totalPages}
                                    </span>

                                    <button
                                        onClick={() => setResultPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={resultPage === totalPages}
                                        className="p-2 rounded-lg hover:bg-white border disabled:opacity-30 transition-all"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}