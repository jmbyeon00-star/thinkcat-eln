"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";

type CitationPredictionChartProps = {
  applicationNumber: string;
};

export default function CitationPredictionChart({
  applicationNumber,
}: CitationPredictionChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [citationInfo, setCitationInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!applicationNumber) return;
    setIsLoading(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";
    fetch(`${API_BASE}/api/patent/citpredict/${applicationNumber}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          console.error("API 오류:", data.error);
          setCitationInfo(null);
          return;
        }
        setCitationInfo(data);
        prepareChartData(data);
      })
      .catch((err) => {
        console.error("API 호출 오류:", err);
        setCitationInfo(null);
      })
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  const prepareChartData = (data: any) => {
    const currentYear = data["연차수"];
    const currentCitation = data["현재 누적 피인용수"];
    const predicted10Year = data["10년차 누적 피인용수"];

    // 예측 추세선 (단순 선형)
    const linePoints = Array.from({ length: 10 }, (_, i) => {
      const year = i + 1;
      const y =
        currentCitation +
        ((predicted10Year - currentCitation) / (10 - currentYear)) *
          (year - currentYear);
      return { year, citation: Math.max(0, Math.round(y)) };
    });

    setChartData(linePoints);
  };

  // ✅ 로딩 상태
  if (isLoading)
    return (
      <div className="flex justify-center items-center h-60 text-zinc-500">
        <div className="animate-spin border-4 border-t-blue-500 border-gray-300 rounded-full h-8 w-8"></div>
        <span className="ml-3">데이터 불러오는 중...</span>
      </div>
    );

  // ✅ 데이터 없을 때
  if (!citationInfo)
    return (
      <p className="text-center text-zinc-400 py-10">
        피인용수 예측 데이터가 없습니다.
      </p>
    );

  // ✅ 안전 접근 (?.)
  const currentYear = citationInfo?.["연차수"] ?? 0;
  const currentCitation = citationInfo?.["현재 누적 피인용수"] ?? 0;
  const predictedCitation = citationInfo?.["10년차 누적 피인용수"] ?? 0;
    
    return (
        <section className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm p-8 mt-6">
            <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
                피인용수 예측
            </h1>
            <div className="space-y-8 mt-8">
                {/* 카드 3개 */}
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard
                    bg="bg-blue-50"
                    border="border-blue-200"
                    title="현재 연차"
                    color="text-blue-800"
                    value={`${currentYear}년`}
                    />
                    <InfoCard
                    bg="bg-green-50"
                    border="border-green-200"
                    title="현재 누적 피인용수"
                    color="text-green-800"
                    value={`${currentCitation.toLocaleString()}회`}
                    />
                    <InfoCard
                    bg="bg-purple-50"
                    border="border-purple-200"
                    title="10년차 예측"
                    color="text-purple-800"
                    value={`${Math.round(predictedCitation).toLocaleString()}회`}
                    />
                </div>

                {/* 차트 */}
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
                    <h3 className="font-semibold mb-4 text-zinc-700">📈 피인용수 추이 예측</h3>

                    <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData}>
                        <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                        <XAxis
                        dataKey="year"
                        label={{
                            value: "연차 (년)",
                            position: "insideBottom",
                            offset: -5,
                        }}
                        />
                        <YAxis
                        label={{
                            value: "누적 피인용수 (회)",
                            angle: -90,
                            position: "insideLeft",
                        }}
                        />
                        <Tooltip
                        contentStyle={{
                            backgroundColor: "#fff",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                        }}
                        />
                        <Legend />
                        <Line
                        type="monotone"
                        dataKey="citation"
                        stroke="#2563eb"
                        strokeWidth={2}
                        dot={false}
                        name="예측 추세"
                        />
                        <ReferenceDot
                        x={currentYear}
                        y={currentCitation}
                        r={6}
                        fill="#1e40af"
                        stroke="#2563eb"
                        label="현재"
                        />
                        <ReferenceDot
                        x={10}
                        y={Math.round(predictedCitation)}
                        r={6}
                        fill="#059669"
                        stroke="#10b981"
                        label="10년차 예측"
                        />
                    </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </section>
    );
}

function InfoCard({
  bg,
  border,
  title,
  color,
  value,
}: {
  bg: string;
  border: string;
  title: string;
  color: string;
  value: string;
}) {
  return (
    <div
      className={`p-5 rounded-lg border ${bg} ${border} flex flex-col justify-center items-center`}
    >
      <div className="text-sm font-semibold text-zinc-500 mb-2">{title}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
