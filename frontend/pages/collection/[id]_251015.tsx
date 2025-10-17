"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Head from "next/head";
import Link from "next/link";
import { ArrowLeft, Database, FileText, Folder, Loader2 } from "lucide-react";
import ModelProgressSSE from "@/components/ModelProgressSSE";

type CollectionDetail = {
  id: number;
  collection_name: string;
  collection_code: string;
  collection_category?: string;
  project_names?: string[];
  data_count?: number;
  created_datetime?: string;
  source_type: string;
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
  const [hasTrainedModel, setHasTrainedModel] = useState(0);

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

  // ✅ 2. 모델 상태 확인
  useEffect(() => {
    async function checkModel() {
      if (!collection) return;
      try {
        const res = await fetch(`${API_BASE}/api/ai/status/rec/${collection.collection_code}`, {
          credentials: "include",
        });
        const data = await res.json();
        setHasTrainedModel(data.version);
      } catch {
        console.warn("모델 상태 확인 실패");
      }
    }
    checkModel();
  }, [collection, hasTrainedModel]);
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

            {hasTrainedModel && (
              <p className="text-sm text-zinc-600 mb-2">
                이미 학습된 추천 모델이 존재합니다.
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-6">
                {/* 학습 파라미터 입력 */}
                <div className="flex-1">
                    <RecommendationTrainingPanel collection={collection} hasTrainedModel={hasTrainedModel} setHasTrainedModel={setHasTrainedModel} />
                </div>

            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function RecommendationTrainingPanel({ collection, hasTrainedModel, setHasTrainedModel }: { collection: CollectionDetail, hasTrainedModel: number, setHasTrainedModel: React.Dispatch<React.SetStateAction<number>>; }) {
    console.log(hasTrainedModel)
    const [params, setParams] = useState({ epoch: 2, batch_size: 16, learning_rate: 2e-5, max_length: 256, shuffle: true, });
    const [modelInfo, setModelInfo] = useState<{ id: number; progress: number; version: number } | null>(null);
  
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(false);
    const API_BASE = "http://192.168.1.20:8000";
    
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

    // 진행률 SSE
    useEffect(() => {
        if (!modelInfo?.id) return;
        const es = new EventSource(`${API_BASE}/api/progress/stream/${modelInfo.id}`);
    
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

    // 추천 추론 요청
    async function handleInferRecommendation(collection: CollectionDetail) {
        try {
        const res = await fetch(`${API_BASE}/api/ai/${collection.id}/infer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
            task_type: "recommendation",
            source_type: collection.source_type,
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
                {hasTrainedModel && hasTrainedModel < 1 && (
                    <button
                        onClick={handleTrainRecommendation}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
                    >
                    {loading ? "학습 요청 중..." : "추천 모델 학습하기"}
                    </button>
                )}

                {/* 🔹 학습 완료 후 (version >= 1) */}
                {hasTrainedModel && hasTrainedModel > 0 && (
                    <div className="flex flex-col justify-start">
                        <button
                            onClick={handleTrainRecommendation}
                            className="mb-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            추가 학습하기
                        </button>
                        <button
                            onClick={() => handleInferRecommendation(collection)}
                            className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                            추천 받기
                        </button>
                    </div>
                )}
                </>
            )}
        </div>
        
        </div>
    );
}
