"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Database,
  FileText,
  Folder,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PlayCircle,
  RefreshCw,
  Sparkles,
  ShoppingCart,
  CheckSquare
} from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";

// 날짜 포맷 함수 (hydration 오류 방지)
const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

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

  const { data: session, status } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [dataItems, setDataItems] = useState<ProjectData[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // ✅ 실제 데이터 조회
  async function fetchCollection(pageNum = 1) {
    if (!id) return;
    if (!token) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/collection/${id}?page=${pageNum}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-500">
          <Loader2 className="animate-spin h-6 w-6" />
          <span className="text-lg">불러오는 중...</span>
        </div>
      </div>
    );
  }

  if (!collection) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-zinc-500">데이터를 불러올 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case "DB":
        return { icon: <Database className="h-6 w-6 text-blue-600" />, bg: "from-blue-50 to-cyan-50", ring: "ring-blue-100" };
      case "FILE":
        return { icon: <FileText className="h-6 w-6 text-indigo-600" />, bg: "from-indigo-50 to-purple-50", ring: "ring-indigo-100" };
      default:
        return { icon: <Folder className="h-6 w-6 text-emerald-600" />, bg: "from-emerald-50 to-teal-50", ring: "ring-emerald-100" };
    }
  };

  const sourceInfo = getSourceIcon(collection.source_type);

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <a
          href="/collection"
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-blue-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>컬렉션 목록으로</span>
        </a>

        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-8 mb-6">
          <div className="flex items-start gap-4">
            <div className={`rounded-xl bg-gradient-to-br ${sourceInfo.bg} p-4 ring-1 ${sourceInfo.ring}`}>
              {sourceInfo.icon}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">
                {collection.collection_name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-zinc-600">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                  <span>코드: {collection.collection_code}</span>
                </div>
                {collection.created_datetime && (
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full"></div>
                    <span>{formatDate(collection.created_datetime)}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  <span className="font-semibold text-blue-600">{totalCount.toLocaleString()}건</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Table Section */}
        <section className="mb-8">
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-blue-100">
              <h2 className="text-lg font-semibold text-zinc-900">컬렉션 데이터</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider w-20">
                      번호
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      제목
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      출원인
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      출원번호
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                      출원일
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {dataItems.length > 0 ? (
                    dataItems.map((d, idx) => (
                      <tr key={d.id} className="hover:bg-blue-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-zinc-500">
                          {(page - 1) * limit + idx + 1}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                          {d.title ?? "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {d.applicant_name ?? "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {d.application_number ?? "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {formatDate(d.application_date)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        등록된 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage(1)}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <ChevronLeft className="w-4 h-4 -ml-2" />
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-4 text-sm text-zinc-700">
                      페이지 <span className="font-semibold text-blue-600">{page}</span> / {totalPages}
                    </span>

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setPage(totalPages)}
                      disabled={page === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4 -ml-2" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">행 개수</span>
                    <select
                      value={limit}
                      onChange={(e) => {
                        setLimit(parseInt(e.target.value, 10));
                        setPage(1);
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      {[10, 20, 50, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}/페이지
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* AI Model Training Section */}
        <RecommendationTrainingPanel collection={collection} setDataItems={setDataItems} />
      </div>
    </div>
  );
}

function RecommendationTrainingPanel({ collection, setDataItems }: {
  collection: CollectionDetail,
  setDataItems: React.Dispatch<React.SetStateAction<any[]>>;
}) {
  const API_BASE = "http://192.168.1.20:8000";

  const [params, setParams] = useState({
    epoch: 2,
    batch_size: 16,
    learning_rate: 2e-5,
    max_length: 256,
    shuffle: true,
    length: 500,
  });

  const [hasTrainedModel, setHasTrainedModel] = useState(0);
  const [modelInfo, setModelInfo] = useState<{ id: number; progress: number; version: number; } | null>(null);
  const [inferenceResults, setInferenceResults] = useState<any[]>([]);
  const [histories, setHistories] = useState<{ train_acc: []; valid_acc: []; train_loss: []; valid_loss: []; } | null>(null);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [resultPage, setResultPage] = useState(1);
  const [resultLimit, setResultLimit] = useState(10);

  // ✅ 실제 모델 상태 조회
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

  // ✅ 실제 추천 결과 조회
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

  // ✅ 실제 진행률 SSE
  useEffect(() => {
    if (!modelInfo?.id) return;
    const es = new EventSource(`${API_BASE}/api/status/progress/stream/${modelInfo.id}`);

    es.onmessage = (e) => {
      const value = Number(e.data);
      setProgress(value);

      if (value >= 100) {
        es.close();
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

  const isTraining = progress > 0 && progress < 100;

  // ✅ 실제 학습 요청
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
        setHasTrainedModel(data.version);
        setProgress(0);
      }
    } catch (err) {
      alert("추천 모델 학습 요청 실패");
    } finally {
      setLoading(false);
    }
  }

  // ✅ 실제 추론 요청
  async function handleInferRecommendation() {
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
      if (data.file_id) window.location.href = `/inference/result/${data.file_id}`;
    } catch (err) {
      console.error("추천 추론 요청 실패:", err);
      alert("추천 추론 요청 실패");
    }
  }

  // ✅ 실제 바구니 전송
  async function handleSubmitCart() {
    if (cartItems.length === 0) return alert("바구니가 비어 있습니다.");
    try {
      setDataItems((prev) => [...prev, ...cartItems]);

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

  const totalPages = Math.ceil(inferenceResults.length / resultLimit);
  const pagedResults = inferenceResults.slice(
    (resultPage - 1) * resultLimit,
    resultPage * resultLimit
  );

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
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 mb-2">Batch Size</span>
                <input
                  type="number"
                  value={params.batch_size}
                  onChange={(e) => setParams({ ...params, batch_size: Number(e.target.value) })}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 mb-2">Learning Rate</span>
                <input
                  type="number"
                  step="0.00001"
                  value={params.learning_rate}
                  onChange={(e) => setParams({ ...params, learning_rate: parseFloat(e.target.value) })}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-medium text-zinc-700 mb-2">Max Length</span>
                <input
                  type="number"
                  value={params.max_length}
                  onChange={(e) => setParams({ ...params, max_length: Number(e.target.value) })}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                />
                <span className="text-sm text-zinc-700">Off</span>
              </label>
            </div>
          </div>

          {/* Training Controls */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            {isTraining ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-700">학습 진행 중...</span>
                  <span className="font-bold text-blue-600">{progress}%</span>
                </div>
                <div className="relative w-full bg-zinc-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="h-6 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                  <span className="absolute inset-0 text-xs font-semibold flex items-center justify-center text-white">
                    {progress}%
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                {hasTrainedModel < 1 ? (
                  <button
                    onClick={handleTrainRecommendation}
                    disabled={loading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-60 transition-all shadow-md font-medium"
                  >
                    <PlayCircle className="w-5 h-5" />
                    <span>모델 학습 시작</span>
                  </button>
                ) : (
                  <button
                    onClick={handleTrainRecommendation}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md font-medium"
                  >
                    <RefreshCw className="w-5 h-5" />
                    <span>추가 학습하기</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Training History Chart */}
          {hasTrainedModel > 0 && histories?.train_acc && histories.train_acc.length > 0 && (
            <div className="bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-xl p-6 border border-zinc-200">
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                학습 결과
              </h3>
              <div className="bg-white rounded-lg p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={histories.train_acc.map((_, i) => ({
                      epoch: i + 1,
                      train_acc: histories.train_acc[i],
                      valid_acc: histories.valid_acc[i],
                      train_loss: histories.train_loss[i],
                      valid_loss: histories.valid_loss[i],
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="epoch" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="train_acc" stroke="#2563eb" name="Train Acc" strokeWidth={2} />
                    <Line type="monotone" dataKey="valid_acc" stroke="#10b981" name="Valid Acc" strokeWidth={2} />
                    <Line type="monotone" dataKey="train_loss" stroke="#f97316" name="Train Loss" strokeWidth={2} />
                    <Line type="monotone" dataKey="valid_loss" stroke="#ef4444" name="Valid Loss" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Inference Controls */}
          {!isTraining && hasTrainedModel > 0 && (
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
                disabled={!modelInfo?.id || loading}
                className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl transition-all shadow-md font-medium ${!modelInfo?.id || loading
                  ? "bg-gray-400 cursor-not-allowed text-white"
                  : "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
                  }`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>추천 중...</span>
                  </>
                ) : modelInfo?.id ? (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>추천 받기</span>
                  </>
                ) : (
                  <span>모델 로딩 중</span>
                )}
              </button>
            </div>
          )}

          {/* Inference Results */}
          {inferenceResults.length > 0 && hasTrainedModel > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 px-6 py-4 border-b border-emerald-100">
                <h3 className="text-lg font-semibold text-zinc-900">추천 결과</h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                      <th className="px-6 py-4 text-left w-12">
                        <input
                          type="checkbox"
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(pagedResults);
                            } else {
                              setSelectedItems([]);
                            }
                          }}
                          className="w-4 h-4 text-blue-600"
                        />
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                        제목
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-zinc-700 uppercase tracking-wider w-32">
                        신뢰도
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {pagedResults.map((r, i) => (
                      <tr key={i} className="hover:bg-emerald-50 transition-colors">
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.includes(r)}
                            onChange={() => {
                              setSelectedItems((prev) =>
                                prev.includes(r)
                                  ? prev.filter((x) => x !== r)
                                  : [...prev, r]
                              );
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-900">{r.title}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-zinc-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600"
                                style={{ width: `${r.confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-emerald-600 w-12 text-right">
                              {(r.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Results Pagination */}
              <div className="bg-zinc-50 border-t border-zinc-200 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResultPage(1)}
                      disabled={resultPage === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <ChevronLeft className="w-4 h-4 -ml-2" />
                    </button>
                    <button
                      onClick={() => setResultPage((p) => Math.max(1, p - 1))}
                      disabled={resultPage === 1}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    <span className="px-4 text-sm text-zinc-700">
                      <span className="font-semibold text-emerald-600">{resultPage}</span> / {totalPages}
                    </span>

                    <button
                      onClick={() => setResultPage((p) => Math.min(totalPages, p + 1))}
                      disabled={resultPage === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setResultPage(totalPages)}
                      disabled={resultPage === totalPages}
                      className="px-3 py-2 rounded-lg border border-zinc-200 text-sm font-medium text-zinc-700 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <ChevronRight className="w-4 h-4 -ml-2" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-600">표시</span>
                    <select
                      value={resultLimit}
                      onChange={(e) => {
                        setResultLimit(Number(e.target.value));
                        setResultPage(1);
                      }}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                    >
                      {[10, 20, 50].map((n) => (
                        <option key={n} value={n}>
                          {n}개
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 py-4 bg-gradient-to-r from-zinc-50 to-zinc-100 border-t border-zinc-200">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setCartItems((prev) => [...prev, ...selectedItems]);
                      setSelectedItems([]);
                    }}
                    disabled={selectedItems.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md font-medium"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    <span>선택 담기 ({selectedItems.length})</span>
                  </button>

                  <button
                    onClick={handleSubmitCart}
                    disabled={cartItems.length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md font-medium"
                  >
                    <CheckSquare className="w-5 h-5" />
                    <span>데이터 추가 ({cartItems.length})</span>
                  </button>
                </div>
              </div>

              {/* Cart Items */}
              {cartItems.length > 0 && (
                <div className="px-6 py-4 bg-yellow-50 border-t border-yellow-200">
                  <h4 className="font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-yellow-600" />
                    <span>데이터 ({cartItems.length}개)</span>
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cartItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white rounded-lg px-4 py-2 text-sm border border-yellow-200"
                      >
                        <span className="text-zinc-900 truncate flex-1">{item.title}</span>
                        <button
                          onClick={() => setCartItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="ml-2 text-red-600 hover:text-red-700 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}