"use client";
import { useEffect, useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

type PatentEvaluationResultProps = {
  appNumber: string;
};

type EvaluationData = {
  application_number: number;
  tech: number;
  legal: number;
  market: number;
  economy: number;
  strategy: number;
  predicted_price: number;
  real_price: string;
};

export default function PatentEvaluationResult({
  appNumber,
}: PatentEvaluationResultProps) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appNumber) return;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/patent/price`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_number: appNumber }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("응답 실패");
        const d = await res.json();
        setData(d);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [appNumber]);

  if (loading)
    return (
      <div className="max-w-5xl mx-auto mt-10 bg-white p-8 rounded-xl border border-zinc-200 shadow-sm animate-pulse">
        <div className="h-6 bg-zinc-200 rounded w-1/3 mb-6"></div>
        <div className="h-24 bg-zinc-100 rounded mb-6"></div>
        <div className="h-72 bg-zinc-100 rounded"></div>
      </div>
    );

  if (error)
    return <p className="text-center text-red-500 mt-10">❌ {error}</p>;

  if (!data)
    return (
      <p className="text-center text-zinc-500 mt-10">
        평가 데이터가 없습니다.
      </p>
    );

  const rows = [
    { name: "기술", value: data.tech },
    { name: "법률", value: data.legal },
    { name: "시장", value: data.market },
    { name: "경제", value: data.economy },
    { name: "전략", value: data.strategy },
  ];

  const chartData = rows.map((r) => ({
    subject: r.name,
    score: r.value,
  }));

  const formatPrice = (n?: number | string) =>
    n ? new Intl.NumberFormat().format(Number(n)) : "-";

  return (
    <section className="max-w-5xl mx-auto bg-white p-8 rounded-xl border border-zinc-200 shadow-sm mt-10">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
        특허 평가
      </h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 평가 점수표 */}
        <div>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-zinc-600">
                <th className="text-left px-4 py-2 font-semibold">항목</th>
                <th className="text-left px-4 py-2 font-semibold">점수</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-2 text-zinc-700">{r.name}</td>
                  <td className="px-4 py-2 text-zinc-900 font-medium">
                    {r.value}
                  </td>
                </tr>
              ))}
              <tr className="bg-zinc-50 font-semibold">
                <td className="px-4 py-2 text-zinc-700">예측가격</td>
                <td className="px-4 py-2 text-blue-600">
                  ₩{formatPrice(data.predicted_price)}
                </td>
              </tr>
              <tr className="font-semibold">
                <td className="px-4 py-2 text-zinc-700">실제가격</td>
                <td className="px-4 py-2 text-zinc-800">
                  ₩{formatPrice(data.real_price)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Radar Chart */}
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" />
              <Radar
                name="Score"
                dataKey="score"
                stroke="#2563eb"
                fill="#2563eb"
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}
