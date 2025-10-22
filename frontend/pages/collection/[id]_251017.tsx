"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, Database, FileText, Folder, Loader2 } from "lucide-react";
import ModelProgressSSE from "@/components/ModelProgressSSE";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CollectionDetail = {
    id: number;
    collection_name: string;
    collection_code: string;
    collection_category?: string;
    project_names?: string[];
    data_count?: number;
    created_datetime?: string;
    task_type: string;
    source_type: string;
    data_scope: string;
};

type ProjectData = {
    id: number;
    title?: string;
    abstract?: string;
    applicant_name?: string;
    application_number?: string;
    application_date?: string;
};

export default function CollectionDetailPage() {
    const params = useParams();
    const id = params?.id ? String(params.id) : null;
    const API_BASE = "http://192.168.1.20:8000";

    const [collection, setCollection] = useState<CollectionDetail | null>(null);
    const [dataItems, setDataItems] = useState<ProjectData[]>([]);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);

    // ✅ 1. 데이터 조회
    async function fetchCollection(pageNum = 1) {
        if (!id) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/collection/${id}?page=${pageNum}&limit=${limit}`, {
                credentials: "include",
            });
            const data = await res.json();
            setCollection(data.collection);
            setDataItems(data.items || []);
            setTotalPages(data.total_pages || 1);
            setTotalCount(data.total || 0);
            setPage(data.page || 1);
        } catch (err) {
            console.error("Failed to fetch collection:", err);
            alert("컬렉션 데이터를 불러오지 못했습니다.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchCollection(page);
    }, [id, page, limit]);

    if (loading)
        return (
            <div className="flex h-[70vh] items-center justify-center text-zinc-500">
                <Loader2 className="animate-spin mr-2 h-5 w-5" /> 불러오는 중...
            </div>
        );

    if (!collection)
        return (
            <div className="flex h-[70vh] items-center justify-center text-zinc-500">
                데이터를 불러올 수 없습니다.
            </div>
        );

    const iconMapper = (type?: string) => {
        switch (type) {
            case "DB":
                return <Database className="h-5 w-5 text-zinc-700" />;
            case "FILE":
                return <FileText className="h-5 w-5 text-zinc-700" />;
            default:
                return <Folder className="h-5 w-5 text-zinc-700" />;
        }
    };

    return (
        <>
            <Head>
                <title>{collection.collection_name} | IPFORCE</title>
            </Head>

            <main className="min-h-[calc(100vh-64px)] w-full px-4 py-6">
                <div className="mx-auto max-w-6xl">
                    <Link
                        href="/collection"
                        className="flex items-center text-sm text-zinc-500 hover:text-zinc-700 mb-4"
                    >
                        <ArrowLeft className="h-4 w-4 mr-1" /> 컬렉션 목록으로
                    </Link>

                    {/* 헤더 */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="rounded-xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                            {iconMapper(collection.source_type)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold text-zinc-900">
                                {collection.collection_name}
                            </h1>
                            <p className="text-sm text-zinc-500 mt-1">
                                코드: {collection.collection_code}
                            </p>
                            <p className="text-xs text-zinc-400 mt-1">
                                생성일:{" "}
                                {collection.created_datetime
                                    ? new Date(collection.created_datetime).toLocaleDateString()
                                    : "-"}{" "}
                                · 총 {totalCount.toLocaleString()}건
                            </p>
                        </div>
                    </div>

                    {/* 데이터 테이블 */}
                    <section className="mt-10 border-t border-zinc-200 pt-6">
                        <h2 className="text-lg font-semibold text-zinc-800 mb-4">컬렉션 리스트</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-sm border border-zinc-200 rounded-lg">
                                <thead className="bg-zinc-100">
                                    <tr>
                                        <th className="px-4 py-2 text-left w-1/12">번호</th>
                                        <th className="px-4 py-2 text-left w-3/12">제목</th>
                                        <th className="px-4 py-2 text-left w-2/12">출원인</th>
                                        <th className="px-4 py-2 text-left w-2/12">출원번호</th>
                                        <th className="px-4 py-2 text-left w-2/12">출원일</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {dataItems.length > 0 ? (
                                        dataItems.map((d, idx) => (
                                            <tr key={d.id} className="border-t hover:bg-zinc-50 transition">
                                                <td className="px-4 py-2 text-zinc-500">
                                                    {(page - 1) * limit + idx + 1}
                                                </td>
                                                <td className="px-4 py-2 font-medium text-zinc-900">
                                                    {d.title ?? "-"}
                                                </td>
                                                <td className="px-4 py-2">{d.applicant_name ?? "-"}</td>
                                                <td className="px-4 py-2">{d.application_number ?? "-"}</td>
                                                <td className="px-4 py-2">
                                                    {d.application_date
                                                        ? new Date(d.application_date).toLocaleDateString()
                                                        : "-"}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                                                등록된 데이터가 없습니다.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>

                            {/* 페이지네이션 */}
                            {totalPages > 1 && (
                                <div className="flex justify-between items-center p-3 border-t border-zinc-200 bg-zinc-50">
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">«</button>
                                        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded text-sm disabled:opacity-50">이전</button>
                                        <span className="text-sm text-zinc-600">
                                            페이지 <b>{page}</b> / {totalPages}
                                        </span>
                                        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">다음</button>
                                        <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-1 border rounded text-sm disabled:opacity-50">»</button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-zinc-600">행 개수</span>
                                        <select
                                            value={limit}
                                            onChange={(e) => {
                                                setLimit(parseInt(e.target.value, 10));
                                                setPage(1);
                                            }}
                                            className="border rounded px-2 py-1 text-sm"
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
                    </section>

                    {/* ✅ 모델 학습/추론 섹션 */}
                    <section className="mt-10 border-t border-zinc-200 pt-6">
                        <h2 className="text-lg font-semibold text-zinc-800 mb-4">추천 모델</h2>

                        <div className="flex flex-col sm:flex-row gap-6">
                            {/* 학습 파라미터 입력 */}
                            <div className="flex-1">
                                <RecommendationTrainingPanel collection={collection} />
                            </div>

                        </div>
                    </section>
                </div>
            </main>
        </>
    );
}

function RecommendationTrainingPanel({ collection }: { collection: CollectionDetail }) {
    const [params, setParams] = useState({ epoch: 2, batch_size: 16, learning_rate: 2e-5, max_length: 256, shuffle: true, length: 500, });
    const [hasTrainedModel, setHasTrainedModel] = useState(0);
    const [modelInfo, setModelInfo] = useState<{ id: number; progress: number; version: number; } | null>(null);
    const [inferenceResults, setInferenceResults] = useState<any[]>([]);
    const [histories, setHistories] = useState<{ train_acc: []; valid_acc: []; train_loss: []; valid_loss: []; } | null>(null);

    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const API_BASE = "http://192.168.1.20:8000";

    console.log(histories)
    //  모델 상태 조회
    useEffect(() => {
        async function checkModel() {
            if (!collection) return;
            try {
                const res = await fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
                    credentials: "include",
                });
                const data = await res.json();
                setHasTrainedModel(data.version);
                setModelInfo({
                    id: data.model_info.id,
                    progress: data.model_info.progress,
                    version: data.version,
                });

                if (data.model_info?.model_status === 1) {
                    fetchRecommendationResult(data.model_info.id);
                }

            } catch {
                console.warn("모델 상태 확인 실패");
            }
        }
        checkModel();
    }, [collection, hasTrainedModel]);

    async function fetchRecommendationResult(modelId: number) {
        try {
            const res = await fetch(`${API_BASE}/api/ai/recommendation/result/${modelId}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("추천 결과를 불러오지 못했습니다.");

            const data = await res.json();
            setInferenceResults(data.results || []);
            setHistories(data.histories || []);

        } catch (err) {
            console.error(err);
        }
    }

    // 진행률 SSE
    useEffect(() => {
        if (!modelInfo?.id) return;
        const es = new EventSource(`${API_BASE}/api/status/progress/stream/${modelInfo.id}`);

        es.onmessage = (e) => {
            const value = Number(e.data);
            setProgress(value);

            if (value >= 100) {
                es.close();
                // 완료 후 모델 version 갱신 fetch
                fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
                    credentials: "include"
                })
                    .then((r) => r.json())
                    .then((data) => setModelInfo((prev) => prev ? { ...prev, version: data.version } : null));
            }
        };

        es.onerror = () => es.close();
        return () => es.close();
    }, [modelInfo?.id]);


    // ✅ version < 1 → 최초 학습 상태
    const isTraining = progress > 0 && progress < 100;
    const canShowButtons = modelInfo?.version && modelInfo.version >= 1;

    // 추천 학습 요청
    async function handleTrainRecommendation() {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/ai/train/recommendation/${collection.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                setModelInfo({ id: data.model_id, progress: 0, version: data.version ?? 0 });
                setHasTrainedModel(data.version)
                setProgress(0);
            }

        } catch (err) {
            alert("추천 모델 학습 요청 실패");
        } finally {
            setLoading(false);
        }
    }

    // 추가 학습 
    async function handleReTrainRecommendation() {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/ai/train/recommendation/${collection.id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                setModelInfo({ id: data.model_id, progress: 0, version: data.version ?? 0 });
                setHasTrainedModel(data.version)
                setProgress(0);
            }

        } catch (err) {
            alert("추천 모델 학습 요청 실패");
        } finally {
            setLoading(false);
        }
    }

    // 추천 추론 요청
    async function handleInferRecommendation(collection: CollectionDetail) {
        try {
            const res = await fetch(`${API_BASE}/api/ai/infer/recommendation`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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
                }),
            });

            const data = await res.json();
            // alert(`추천 추론 요청 완료: ${data.status || "ok"}`);
            if (data.file_id) window.location.href = `/inference/result/${data.file_id}`;
        } catch (err) {
            console.error("추천 추론 요청 실패:", err);
            alert("추천 추론 요청 실패");
        }
    }

    // 추천 결과
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [cartItems, setCartItems] = useState<any[]>([]);
    const [resultPage, setResultPage] = useState(1);
    const [resultLimit, setResultLimit] = useState(10);
    const totalPages = Math.ceil(inferenceResults.length / resultLimit);
    const pagedResults = inferenceResults.slice(
        (resultPage - 1) * resultLimit,
        resultPage * resultLimit
    );

    // ✅ 바구니 전송
    async function handleSubmitCart() {
        if (cartItems.length === 0) return alert("바구니가 비어 있습니다.");
        try {
            await fetch(`${API_BASE}/api/cart/add`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ items: cartItems }),
            });
            alert("추가 완료!");
            setCartItems([]);
        } catch {
            alert("전송 실패");
        }
    }

    return (
        <div className="space-y-4 border p-4 rounded-lg bg-zinc-50">
            <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="flex flex-col">
                    Epoch
                    <input
                        type="number"
                        value={params.epoch}
                        onChange={(e) => setParams({ ...params, epoch: Number(e.target.value) })}
                        className="mt-1 border rounded px-2 py-1"
                    />
                </label>
                <label className="flex flex-col">
                    Batch Size
                    <input
                        type="number"
                        value={params.batch_size}
                        onChange={(e) => setParams({ ...params, batch_size: Number(e.target.value) })}
                        className="mt-1 border rounded px-2 py-1"
                    />
                </label>
                <label className="flex flex-col">
                    Learning Rate
                    <input
                        type="number"
                        step="0.00001"
                        value={params.learning_rate}
                        onChange={(e) => setParams({ ...params, learning_rate: parseFloat(e.target.value) })}
                        className="mt-1 border rounded px-2 py-1"
                    />
                </label>
                <label className="flex flex-col">
                    Max Length
                    <input
                        type="number"
                        value={params.max_length}
                        onChange={(e) => setParams({ ...params, max_length: Number(e.target.value) })}
                        className="mt-1 border rounded px-2 py-1"
                    />
                </label>
            </div>

            {/* Shuffle 옵션 */}
            <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="radio"
                        name="shuffle"
                        checked={params.shuffle === true}
                        onChange={() => setParams({ ...params, shuffle: true })}
                    />
                    <span>Shuffle On</span>
                </label>
                <label className="flex items-center gap-1 text-sm">
                    <input
                        type="radio"
                        name="shuffle"
                        checked={params.shuffle === false}
                        onChange={() => setParams({ ...params, shuffle: false })}
                    />
                    <span>Shuffle Off</span>
                </label>
            </div>

            {/* 학습 및 추론 버튼 */}
            <div className="space-y-4 border p-4 rounded-lg bg-zinc-50 flex flex-col justify-start">
                {/* 🔹 학습 중에는 모든 버튼 감춤 */}
                {isTraining ? (
                    <ModelProgressSSE targetId={modelInfo!.id} initialProgress={progress} />
                ) : (
                    <>
                        {/* 🔹 최초 학습 전 */}
                        {hasTrainedModel < 1 && (
                            <button
                                onClick={handleTrainRecommendation}
                                disabled={loading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                            >
                                {loading ? "학습 요청 중..." : "추천 모델 학습하기"}
                            </button>
                        )}

                        {/* 🔹 학습 완료 후 (version >= 1) */}
                        {hasTrainedModel > 0 && (
                            <div className="flex flex-col justify-start">
                                <button
                                    onClick={handleReTrainRecommendation}
                                    className="mb-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                >
                                    추가 학습하기
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* 📈 학습 히스토리 그래프 */}
            {/* {histories.length > 0 && (
                        <div className="rounded-xl border bg-white p-4">
                            <h2 className="text-lg font-semibold mb-2">📈 학습 결과</h2>
                            <div className="h-72">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart
                                        data={histories.map((h, i) => ({
                                            epoch: h.epoch ?? i + 1,
                                            train_acc: h.train_acc,
                                            valid_acc: h.valid_acc,
                                            train_loss: h.train_loss,
                                            valid_loss: h.valid_loss,
                                        }))}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="epoch" />
                                        <YAxis />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="train_acc"
                                            stroke="#2563eb"
                                            name="Train Acc"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="valid_acc"
                                            stroke="#16a34a"
                                            name="Valid Acc"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="train_loss"
                                            stroke="#f97316"
                                            name="Train Loss"
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="valid_loss"
                                            stroke="#dc2626"
                                            name="Valid Loss"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )} */}

            {histories?.train_acc && histories.train_acc.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                    <h2 className="text-lg font-semibold mb-2">📈 학습 결과</h2>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={histories.train_acc.map((_, i) => ({
                                    epoch: i + 1,
                                    train_acc: histories.train_acc[i],
                                    valid_acc: histories.valid_acc[i],
                                    train_loss: histories.train_loss[i],
                                    valid_loss: histories.valid_loss[i],
                                }))}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="epoch" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="train_acc"
                                    stroke="#2563eb"
                                    name="Train Acc"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="valid_acc"
                                    stroke="#16a34a"
                                    name="Valid Acc"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="train_loss"
                                    stroke="#f97316"
                                    name="Train Loss"
                                />
                                <Line
                                    type="monotone"
                                    dataKey="valid_loss"
                                    stroke="#dc2626"
                                    name="Valid Loss"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}



            {/* 🔹 학습 중에는 모든 버튼 감춤 */}
            {!isTraining && hasTrainedModel > 0 && (
                <div className="space-y-4 border p-4 rounded-lg bg-zinc-50 flex flex-col justify-start">
                    <div className="grid grid-cols-1 gap-4 text-sm">
                        <label className="flex flex-col">
                            <span className="mb-2 font-medium">추천 갯수</span>
                            <div className="flex items-center space-x-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="1000"
                                    step="1"
                                    value={params.length}
                                    onChange={(e) => setParams({ ...params, length: Number(e.target.value) })}
                                    className="w-full accent-blue-600 cursor-pointer"
                                />
                                <span className="w-10 text-center font-semibold text-zinc-700">
                                    {params.length}
                                </span>
                            </div>
                        </label>
                    </div>

                    <div className="flex flex-col justify-start">
                        <button
                            onClick={() => handleInferRecommendation(collection)}
                            disabled={!modelInfo?.id || loading}
                            className={`mt-2 px-4 py-2 rounded-lg transition-colors ${!modelInfo?.id || loading
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                }`}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center space-x-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>추천중...</span>
                                </span>
                            ) : modelInfo?.id ? (
                                "추천 받기"
                            ) : (
                                "모델 로딩중"
                            )}
                        </button>
                    </div>
                </div>
            )}

            {/* 추천 데이터 */}
            {inferenceResults.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                    <h2 className="text-lg font-semibold mb-3">추천 결과</h2>
                    <table className="w-full text-sm border">
                        <thead className="bg-zinc-100">
                            <tr>
                                <th className="w-10 text-center">선택</th>
                                <th>제목</th>
                                {/* <th>예측</th> */}
                                <th>확률</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pagedResults.map((r, i) => (
                                <tr key={i} className="border-t hover:bg-zinc-50">
                                    <td className="text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(r)}
                                            onChange={() =>
                                                setSelectedItems((prev) =>
                                                    prev.includes(r)
                                                        ? prev.filter((x) => x !== r)
                                                        : [...prev, r]
                                                )
                                            }
                                        />
                                    </td>
                                    <td>{r.title}</td>
                                    {/* <td>{r.pred_label}</td> */}
                                    <td>{(r.confidence * 100).toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* 페이지네이션 */}
                    <div className="flex justify-between items-center mt-3 text-sm">
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => setResultPage(1)}
                                disabled={resultPage === 1}
                                className="border px-2 rounded"
                            >
                                «
                            </button>
                            <button
                                onClick={() => setResultPage((p) => Math.max(1, p - 1))}
                                disabled={resultPage === 1}
                                className="border px-2 rounded"
                            >
                                이전
                            </button>
                            <span>
                                {resultPage}/{totalPages}
                            </span>
                            <button
                                onClick={() =>
                                    setResultPage((p) => Math.min(totalPages, p + 1))
                                }
                                disabled={resultPage === totalPages}
                                className="border px-2 rounded"
                            >
                                다음
                            </button>
                            <button
                                onClick={() => setResultPage(totalPages)}
                                disabled={resultPage === totalPages}
                                className="border px-2 rounded"
                            >
                                »
                            </button>
                        </div>
                        <div className="flex gap-2 items-center">
                            <span>표시</span>
                            <select
                                value={resultLimit}
                                onChange={(e) => {
                                    setResultLimit(Number(e.target.value));
                                    setResultPage(1);
                                }}
                                className="border rounded px-1 py-0.5"
                            >
                                {[10, 20, 50].map((n) => (
                                    <option key={n} value={n}>
                                        {n}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 선택 담기 */}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => {
                                setCartItems((prev) => [...prev, ...selectedItems]);
                                setSelectedItems([]);
                            }}
                            disabled={selectedItems.length === 0}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                            선택 담기
                        </button>
                        <button
                            onClick={handleSubmitCart}
                            disabled={cartItems.length === 0}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            추가하기
                        </button>
                    </div>

                    {/* 바구니 */}
                    {cartItems.length > 0 && (
                        <div className="mt-6 border-t pt-4">
                            <h4 className="font-semibold mb-2">
                                🧺 바구니 ({cartItems.length}개)
                            </h4>
                            <ul className="list-disc ml-5 text-sm">
                                {cartItems.map((item, idx) => (
                                    <li key={idx}>{item.title}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}



        </div>
    );
}
