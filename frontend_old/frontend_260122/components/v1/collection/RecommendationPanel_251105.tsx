import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Sparkles, ShoppingCart, BarChart3, Plus, Zap } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "recharts";
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import ModelProgressSSE from "@/components/ModelProgressSSE";

// 타입을 분리 파일로 두어도 되지만 일단 간단히 유지
type CollectionDetail = {
    id: number;
    collection_name: string;
    collection_code: string;
    source_type: string;
    project_names?: string[];
    mean_vector?: string;
};


// AI 추천 모델 패널
export default function RecommendationPanel({
    collection,
    setDataItems,
    token
}: {
    collection: CollectionDetail;
    setDataItems: React.Dispatch<React.SetStateAction<any[]>>;
    token?: string;
}) {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
    const resultsRef = useRef<HTMLDivElement>(null);

    // ✅ Zustand store 상태 활용
    const { isBusy, progress: storeProgress, status: storeStatus, setState } = useUserTaskStore();

    const [params, setParams] = useState({
        epoch: 5,
        batch_size: 128,
        learning_rate: 1e-5,
        max_length: 256,
        shuffle: true,
        length: 500,
    });

    const [hasTrainedModel, setHasTrainedModel] = useState(0);
    const [modelInfo, setModelInfo] = useState<{ id: number; progress: number; version: number; model_status?: number } | null>(null);
    const [inferenceResults, setInferenceResults] = useState<any[]>([]);
    const [histories, setHistories] = useState<{ train_acc: []; valid_acc: []; train_loss: []; valid_loss: []; } | null>(null);
    const [inferenceTaskId, setInferenceTaskId] = useState<number | null>(null);
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [resultPage, setResultPage] = useState(1);
    const [resultLimit, setResultLimit] = useState(10);

    // ✅ 초기 모델 상태 확인
    useEffect(() => {
        async function checkModel() {
            if (!collection || !token) return;
            try {
                const res = await fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include",
                });
                const data = await res.json();

                setHasTrainedModel(data.version);
                const newModelInfo = {
                    id: data.model_info.id,
                    progress: data.model_info.progress,
                    version: data.version,
                    model_status: data.model_info.model_status
                };
                setModelInfo(newModelInfo);

                // 학습 중인 상태면 글로벌 상태 동기화
                if (data.model_info.progress > 0 && data.model_info.progress < 100) {
                    setState({ isBusy: true, status: 'RUNNING', progress: data.model_info.progress });
                }

                // 학습 완료된 모델인 경우 결과 자동 로드
                if (data.model_info?.model_status === 1 && data.model_info.progress === 100) {
                    fetchRecommendationResult(data.model_info.id);
                }
            } catch {
                console.warn("모델 상태 확인 실패");
            }
        }
        checkModel();
    }, [collection, token]);

    // ✅ 진행률 100% 도달 시 완료 처리
    useEffect(() => {
        console.log('[완료 감지 useEffect]', {
            storeProgress,
            isBusy,
            storeStatus,
            inferenceTaskId,
            condition: storeProgress === 100 && isBusy
        });

        if (storeProgress === 100 && isBusy) {
            console.log('[🎯 완료 조건 충족]', { storeStatus, inferenceTaskId });

            if (storeStatus === 'RUNNING') {
                console.log('[📚 학습 완료] 결과 조회 시작');
                // 학습 완료
                fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
                    headers: { Authorization: `Bearer ${token}` },
                    credentials: "include"
                })
                    .then((r) => r.json())
                    .then((data) => {
                        console.log('[학습 결과 데이터]', data);
                        setHasTrainedModel(data.version);
                        setModelInfo({
                            id: data.model_info.id,
                            progress: data.model_info.progress,
                            version: data.version,
                            model_status: data.model_info.model_status
                        });

                        // 학습 결과 자동 로드
                        if (data.model_info?.model_status === 1) {
                            fetchRecommendationResult(data.model_info.id);
                        }

                        setState({ isBusy: false, status: 'AVAILABLE', progress: 100 });
                    })
                    .catch((err) => console.error('[학습 결과 조회 실패]', err));

            } else if (storeStatus === 'INFERRING' && inferenceTaskId) {
                console.log('[🔮 추론 완료] 결과 조회 시작:', inferenceTaskId);

                fetchInferenceResult(inferenceTaskId)
                    .then(() => {
                        console.log('[✅ 추론 결과 조회 성공]');
                    })
                    .catch((err) => {
                        console.error('[❌ 추론 결과 조회 실패]', err);
                    });

                setState({ isBusy: false, status: 'AVAILABLE', progress: 100 });
            } else {
                console.log('[⚠️ 완료 조건 미충족]', {
                    currentStatus: storeStatus,
                    isINFERRING: storeStatus === 'INFERRING',
                    hasTaskId: !!inferenceTaskId,
                    reason: !inferenceTaskId ? 'inferenceTaskId 없음' : '기타'
                });
            }
        }
    }, [storeProgress, isBusy, storeStatus, inferenceTaskId, collection.collection_code, token]);

    // ✅ 추가: AVAILABLE 상태로 전환 시에도 결과 확인 (폴백)
    useEffect(() => {
        // 추론이 완료되었고 (progress 100), 상태가 AVAILABLE이 되었는데, 결과가 없으면 조회
        if (storeProgress === 100 && storeStatus === 'AVAILABLE' && inferenceTaskId && inferenceResults.length === 0) {
            console.log('[🔄 폴백] AVAILABLE 상태에서 결과 재조회:', inferenceTaskId);
            setTimeout(() => {
                fetchInferenceResult(inferenceTaskId);
            }, 500); // 0.5초 대기 후 조회
        }
    }, [storeProgress, storeStatus, inferenceTaskId, inferenceResults.length]);

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

    async function fetchInferenceResult(taskId: number) {
        try {
            const res = await fetch(`${API_BASE}/api/ai/recommendation/inference/result/${taskId}`, {
                headers: { Authorization: `Bearer ${token}` },
                credentials: "include",
            });
            if (!res.ok) throw new Error("추론 결과를 불러오지 못했습니다.");
            const data = await res.json();

            if (data.results && data.results.length > 0) {
                setInferenceResults(data.results);

                setTimeout(() => {
                    resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        } catch (err) {
            console.error(err);
        }
    }

    async function handleTrainRecommendation() {
        setState({ isBusy: true, status: 'RUNNING', progress: 0 });

        try {
            const res = await fetch(`${API_BASE}/api/ai/train/recommendation/${collection.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({
                    data_scope: "collection",
                    task_type: "recommendation",
                    source_type: collection.source_type,
                    collection_name: collection.collection_name,
                    collection_code: collection.collection_code,
                    collection_num: 1,
                    model_name: `${collection?.collection_name} 추천 모델`,
                    project_name: collection.project_names?.[0] ?? "추천 테스트",
                    ...params,
                }),
            });
            const data = await res.json();

            if (data.model_id) {
                setModelInfo({
                    id: data.model_id,
                    progress: 0,
                    version: data.version ?? 0,
                    model_status: 0
                });
                setHasTrainedModel(data.version);
            }
        } catch (err) {
            alert("추천 모델 학습 요청 실패");
            setState({ isBusy: false, status: 'AVAILABLE' });
        }
    }

    async function handleReTrainRecommendation() {
        alert("현재 제공되지 않는 기능입니다.");
    }

    async function handleInferRecommendation() {
        setState({ isBusy: true, status: 'INFERRING', progress: 0 });

        try {
            const res = await fetch(`${API_BASE}/api/ai/infer/recommendation`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({
                    data_scope: "collection",
                    task_type: "recommendation",
                    source_type: collection.source_type,
                    model_id: modelInfo?.id,
                    collection_id: collection.id,
                    collection_name: collection.collection_name,
                    collection_code: collection.collection_code,
                    collection_num: 1,
                    project_name: collection.project_names?.[0] ?? "추천 추론 테스트",
                    model_name: `${collection?.collection_name} 추천 모델`,
                    length: params.length,
                }),
            });
            const data = await res.json();

            // ✅ 추론 task_id는 model_id와 동일
            if (data.task_id) {
                setInferenceTaskId(data.task_id);
            } else if (modelInfo?.id) {
                setInferenceTaskId(modelInfo.id);
            } else {
                throw new Error("task_id를 받지 못했습니다.");
            }
        } catch (err) {
            console.error("추천 추론 요청 실패:", err);
            alert("추천 추론 요청 실패");
            setState({ isBusy: false, status: 'AVAILABLE' });
        }
    }

    async function handleAddToCart(item: any) {
        setCartItems(prev => [...prev, item]);
    }

    async function handleSubmitCart() {
        if (cartItems.length === 0) return alert("바구니가 비어 있습니다.");
        try {
            setDataItems((prev) => [...prev, ...cartItems]);

            await fetch(`${API_BASE}/api/cart/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                credentials: "include",
                body: JSON.stringify({ items: cartItems }),
            });
            alert("추가 완료!");
            setCartItems([]);
        } catch {
            alert("전송 실패");
        }
    }

    const totalPages = Math.ceil(inferenceResults.length / resultLimit);
    const pagedResults = inferenceResults.slice(
        (resultPage - 1) * resultLimit,
        resultPage * resultLimit
    );

    // ✅ 버튼 활성화 조건 수정
    const canTrain = !isBusy && hasTrainedModel < 1;
    const canInfer = !isBusy && hasTrainedModel > 0 && modelInfo?.progress === 100;
    const isInferring = isBusy && storeStatus === 'INFERRING';

    return (
        <section>
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-semibold text-white">AI 추천 모델</h2>
                    </div>
                    <p className="text-blue-100 text-sm mt-1">
                        인공지능 기반 특허 추천 시스템
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    {/* Training Parameters */}
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
                                    disabled={isBusy}
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                />
                            </label>
                            <label className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-700 mb-2">Batch Size</span>
                                <input
                                    type="number"
                                    value={params.batch_size}
                                    onChange={(e) => setParams({ ...params, batch_size: Number(e.target.value) })}
                                    disabled={isBusy}
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                />
                            </label>
                            <label className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-700 mb-2">Learning Rate</span>
                                <input
                                    type="number"
                                    step="0.00001"
                                    value={params.learning_rate}
                                    onChange={(e) => setParams({ ...params, learning_rate: parseFloat(e.target.value) })}
                                    disabled={isBusy}
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                                />
                            </label>
                            <label className="flex flex-col">
                                <span className="text-sm font-medium text-zinc-700 mb-2">Max Length</span>
                                <input
                                    type="number"
                                    value={params.max_length}
                                    onChange={(e) => setParams({ ...params, max_length: Number(e.target.value) })}
                                    disabled={isBusy}
                                    className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-zinc-100 disabled:cursor-not-allowed"
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
                                    disabled={isBusy}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-zinc-700">On</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    name="shuffle"
                                    checked={params.shuffle === false}
                                    onChange={() => setParams({ ...params, shuffle: false })}
                                    disabled={isBusy}
                                    className="w-4 h-4 text-blue-600"
                                />
                                <span className="text-sm text-zinc-700">Off</span>
                            </label>
                        </div>
                    </div>

                    {/* Training Controls */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                        {isBusy && storeStatus === 'RUNNING' && modelInfo?.id ? (
                            /* ✅ 학습 중일 때 SSE 진행률 표시 */
                            <div>
                                <ModelProgressSSE
                                    targetId={modelInfo.id}
                                    initialProgress={modelInfo.progress}
                                    setValue={(progress) => setState({ progress })}
                                />
                            </div>
                        ) : (
                            <div className="flex gap-3">
                                {canTrain ? (
                                    <button
                                        onClick={handleTrainRecommendation}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md font-medium"
                                    >
                                        <Zap className="w-5 h-5" />
                                        <span>모델 학습 시작</span>
                                    </button>
                                ) : hasTrainedModel > 0 ? (
                                    <button
                                        onClick={handleReTrainRecommendation}
                                        disabled={isBusy}
                                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <RefreshCw className="w-5 h-5" />
                                        <span>추가 학습하기</span>
                                    </button>
                                ) : null}
                            </div>
                        )}
                    </div>

                    {/* Training History Charts - 개선된 디자인 */}
                    {hasTrainedModel > 0 && histories?.train_acc && histories.train_acc.length > 0 && (
                        <div className="space-y-6">
                            {/* Accuracy Chart */}
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl overflow-hidden border border-blue-100 shadow-sm">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                                <BarChart3 className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Accuracy (정확도)</h3>
                                                <p className="text-xs text-blue-100">모델의 예측 정확도 추이</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                                                <span className="text-white/90 font-medium">Train</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-emerald-400 rounded-full"></div>
                                                <span className="text-white/90 font-medium">Valid</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart
                                            data={histories.train_acc.map((_, i) => ({
                                                epoch: i + 1,
                                                train_acc: (Number(histories.train_acc[i]) * 100).toFixed(2),
                                                valid_acc: (Number(histories.valid_acc[i]) * 100).toFixed(2),
                                            }))}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                            <XAxis
                                                dataKey="epoch"
                                                tick={{ fill: '#52525b', fontSize: 12, fontWeight: 500 }}
                                                label={{ value: 'Epoch', position: 'insideBottom', offset: -5, style: { fill: '#71717a', fontSize: 12, fontWeight: 600 } }}
                                            />
                                            <YAxis
                                                tick={{ fill: '#52525b', fontSize: 12, fontWeight: 500 }}
                                                label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fill: '#71717a', fontSize: 12, fontWeight: 600 } }}
                                                domain={[0, 100]}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#fff',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    padding: '12px'
                                                }}
                                                labelStyle={{ fontWeight: 600, color: '#18181b', marginBottom: '8px' }}
                                                formatter={(value: any) => [`${value}%`, '']}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="train_acc"
                                                stroke="#3b82f6"
                                                strokeWidth={3}
                                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                name="Train Accuracy"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="valid_acc"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                name="Valid Accuracy"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>

                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-blue-100">
                                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
                                            <div className="text-xs font-semibold text-blue-600 mb-1">최종 Train Accuracy</div>
                                            <div className="text-2xl font-bold text-blue-900">
                                                {(Number(histories.train_acc[histories.train_acc.length - 1]) * 100).toFixed(2)}%
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4">
                                            <div className="text-xs font-semibold text-emerald-600 mb-1">최종 Valid Accuracy</div>
                                            <div className="text-2xl font-bold text-emerald-900">
                                                {(Number(histories.valid_acc[histories.valid_acc.length - 1]) * 100).toFixed(2)}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Loss Chart */}
                            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl overflow-hidden border border-orange-100 shadow-sm">
                                <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                                <BarChart3 className="w-5 h-5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Loss (손실)</h3>
                                                <p className="text-xs text-orange-100">모델의 학습 손실 추이</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                                                <span className="text-white/90 font-medium">Train</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                                                <span className="text-white/90 font-medium">Valid</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-white p-6">
                                    <ResponsiveContainer width="100%" height={280}>
                                        <LineChart
                                            data={histories.train_loss.map((_, i) => ({
                                                epoch: i + 1,
                                                train_loss: Number(histories.train_loss[i]).toFixed(4),
                                                valid_loss: Number(histories.valid_loss[i]).toFixed(4),
                                            }))}
                                            margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                                        >
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                                            <XAxis
                                                dataKey="epoch"
                                                tick={{ fill: '#52525b', fontSize: 12, fontWeight: 500 }}
                                                label={{ value: 'Epoch', position: 'insideBottom', offset: -5, style: { fill: '#71717a', fontSize: 12, fontWeight: 600 } }}
                                            />
                                            <YAxis
                                                tick={{ fill: '#52525b', fontSize: 12, fontWeight: 500 }}
                                                label={{ value: 'Loss', angle: -90, position: 'insideLeft', style: { fill: '#71717a', fontSize: 12, fontWeight: 600 } }}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: '#fff',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '12px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                                    padding: '12px'
                                                }}
                                                labelStyle={{ fontWeight: 600, color: '#18181b', marginBottom: '8px' }}
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="train_loss"
                                                stroke="#f97316"
                                                strokeWidth={3}
                                                dot={{ fill: '#f97316', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                name="Train Loss"
                                            />
                                            <Line
                                                type="monotone"
                                                dataKey="valid_loss"
                                                stroke="#ef4444"
                                                strokeWidth={3}
                                                dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
                                                activeDot={{ r: 6, strokeWidth: 2 }}
                                                name="Valid Loss"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>

                                    {/* Summary Stats */}
                                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-orange-100">
                                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4">
                                            <div className="text-xs font-semibold text-orange-600 mb-1">최종 Train Loss</div>
                                            <div className="text-2xl font-bold text-orange-900">
                                                {Number(histories.train_loss[histories.train_loss.length - 1]).toFixed(4)}
                                            </div>
                                        </div>
                                        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-xl p-4">
                                            <div className="text-xs font-semibold text-red-600 mb-1">최종 Valid Loss</div>
                                            <div className="text-2xl font-bold text-red-900">
                                                {Number(histories.valid_loss[histories.valid_loss.length - 1]).toFixed(4)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Inference Controls & Progress */}
                    {hasTrainedModel > 0 && (
                        <>
                            {!isBusy && (
                                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-100">
                                    <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-gradient-to-b from-emerald-600 to-teal-600 rounded-full" />
                                        추천 설정
                                    </h3>

                                    <label className="flex flex-col mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-zinc-700">추천 개수</span>
                                            <span className="text-sm font-bold text-emerald-600">{params.length}개</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="1"
                                            max="1000"
                                            step="1"
                                            value={params.length}
                                            onChange={(e) => setParams({ ...params, length: Number(e.target.value) })}
                                            className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                        />
                                    </label>

                                    <button
                                        onClick={handleInferRecommendation}
                                        disabled={!canInfer}
                                        className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all shadow-md font-medium ${canInfer
                                            ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                                            : "bg-gray-300 cursor-not-allowed text-gray-500"
                                            }`}
                                    >
                                        {canInfer ? (
                                            <>
                                                <Sparkles className="w-5 h-5" />
                                                <span>추천 받기</span>
                                            </>
                                        ) : (
                                            <span>학습 완료 후 사용 가능</span>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Inference Progress */}
                            {isInferring && inferenceTaskId && (
                                <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                                    <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                                        <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full" />
                                        추천 진행 중
                                    </h3>
                                    <ModelProgressSSE
                                        targetId={inferenceTaskId}
                                        initialProgress={0}
                                        setValue={(progress) => setState({ progress })}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {/* Inference Results */}
                    {inferenceResults.length > 0 && (
                        <div ref={resultsRef} className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
                                    <div className="w-1 h-5 bg-gradient-to-b from-purple-600 to-pink-600 rounded-full" />
                                    추천 결과
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-zinc-600">총 {inferenceResults.length}건</span>
                                    {cartItems.length > 0 && (
                                        <button
                                            onClick={handleSubmitCart}
                                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm"
                                        >
                                            <ShoppingCart className="w-4 h-4" />
                                            <span>바구니 ({cartItems.length})</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white rounded-lg overflow-hidden border border-purple-200">
                                <div className="overflow-x-auto">
                                    <table className="min-w-full">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-purple-50 to-pink-50 border-b border-purple-200">
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider w-16">
                                                    순위
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                                                    제목
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                                                    출원인
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                                                    유사도
                                                </th>
                                                <th className="px-4 py-3 text-center text-xs font-semibold text-zinc-700 uppercase tracking-wider w-24">
                                                    추가
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-zinc-100">
                                            {pagedResults.map((result, idx) => (
                                                <tr key={idx} className="hover:bg-purple-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-zinc-500 font-medium">
                                                        {(resultPage - 1) * resultLimit + idx + 1}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-zinc-900">
                                                        {result.title || "-"}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-zinc-600">
                                                        {result.applicant_name || "-"}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                                            {(result.similarity * 100).toFixed(1)}%
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => handleAddToCart(result)}
                                                            disabled={cartItems.some(item => item.id === result.id)}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                        >
                                                            <Plus className="w-3 h-3" />
                                                            <span>추가</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {totalPages > 1 && (
                                    <div className="bg-purple-50 border-t border-purple-200 px-4 py-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => setResultPage(p => Math.max(1, p - 1))}
                                                    disabled={resultPage === 1}
                                                    className="px-2 py-1 rounded border border-purple-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>

                                                <span className="px-3 text-sm text-zinc-700">
                                                    <span className="font-semibold text-purple-600">{resultPage}</span> / {totalPages}
                                                </span>

                                                <button
                                                    onClick={() => setResultPage(p => Math.min(totalPages, p + 1))}
                                                    disabled={resultPage === totalPages}
                                                    className="px-2 py-1 rounded border border-purple-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>

                                            <select
                                                value={resultLimit}
                                                onChange={(e) => {
                                                    setResultLimit(parseInt(e.target.value, 10));
                                                    setResultPage(1);
                                                }}
                                                className="rounded-lg border border-purple-200 px-2 py-1 text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-100"
                                            >
                                                {[10, 20, 50, 100].map((n) => (
                                                    <option key={n} value={n}>
                                                        {n}/페이지
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}