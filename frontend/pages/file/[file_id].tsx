"use client"; 

import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { BarChart3, CircleDashed, CircleCheckBig } from "lucide-react";

type InferenceResult = {
  source: string;
  predicted_target: string;
  score: number;
};

type InferenceDetail = {
  file_id: number;
  file_name: string;
  model_name: string;
  task_type: string;
  created_datetime: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  total_rows: number;
  used_collections: string[];
  summary: { positive: number; negative: number };
  results: InferenceResult[];
};

export default function FileDetailPage() {
  const router = useRouter();
  const { file_id } = router.query;
  const API_BASE = "http://192.168.1.20:8000";

  const [data, setData] = useState<InferenceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ✅ router가 준비될 때까지 기다리기
    if (!router.isReady || !file_id) return;

    const loadDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/history/${file_id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("불러오기 실패:", err);
        alert("결과를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [router.isReady, file_id]); // ✅ router.isReady 추가

  if (loading)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
        <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
      </div>
    );

  if (!data)
    return <p className="text-center mt-10 text-zinc-500">데이터가 없습니다.</p>;

    return (
        <>
            <Head>
                <title>{data.file_name} | 추론 결과</title>
            </Head>

            <main className="max-w-6xl mx-auto px-6 py-10">
                {/* 상단 요약 */}
                <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">{data.file_name}</h1>
                    <p className="text-zinc-500 text-sm">
                    {data.model_name} · {new Date(data.created_datetime).toLocaleString()}
                    </p>
                </div>
                {data.status === "RUNNING" ? (
                    <CircleDashed className="h-8 w-8 text-blue-500 animate-spin" />
                ) : data.status === "FAILED" ? (
                    <span className="text-red-600 font-semibold">실패</span>
                ) : (
                    <CircleCheckBig className="h-8 w-8 text-green-600" />
                )}
                </div>

                {/* 데이터 요약 */}
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-zinc-50 border">
                    <p className="text-xs text-zinc-400">총 데이터</p>
                    <p className="text-lg font-semibold">{data.total_rows.toLocaleString()}건</p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border">
                    <p className="text-xs text-zinc-400">Positive</p>
                    <p className="text-lg font-semibold text-green-600">
                    {data.summary?.positive ?? 0}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border">
                    <p className="text-xs text-zinc-400">Negative</p>
                    <p className="text-lg font-semibold text-red-600">
                    {data.summary?.negative ?? 0}
                    </p>
                </div>
                <div className="p-4 rounded-xl bg-zinc-50 border">
                    <p className="text-xs text-zinc-400">사용된 Collection</p>
                    <p className="text-sm font-medium text-zinc-700">
                    {data.used_collections.join(", ")}
                    </p>
                </div>
                </div>

                {/* 결과 테이블 */}
                <div className="mt-10">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-500" /> 추론 결과
                </h2>

                <div className="overflow-x-auto rounded-xl border border-zinc-200 shadow-sm">
                    <table className="w-full text-sm">
                    <thead className="bg-zinc-50 text-zinc-600">
                        <tr>
                        <th className="px-4 py-2 text-left">입력 데이터</th>
                        <th className="px-4 py-2 text-left">예측 결과</th>
                        <th className="px-4 py-2 text-left">유사도 점수</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.results.map((r, i) => (
                        <tr key={i} className="hover:bg-blue-50/40">
                            <td className="px-4 py-2">{r.source}</td>
                            <td className="px-4 py-2 font-medium text-blue-700">
                            {r.predicted_target}
                            </td>
                            <td className="px-4 py-2 text-right">
                            {(r.score * 100).toFixed(1)}%
                            </td>
                        </tr>
                        ))}
                    </tbody>
                    </table>
                </div>
                </div>
            </main>
        </>
    );
}
