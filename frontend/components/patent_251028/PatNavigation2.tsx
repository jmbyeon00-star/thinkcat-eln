"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Label,
  ZAxis,
} from "recharts";

type NavigationData = {
  application_number: string;
  x_value: number;
  y_value: number;
  score: number;
  date_type: number;
};

type PatNavigationProps = {
  applicationNumber: string;
  code: string;
};

export default function PatNavigationChart({
  applicationNumber,
  code,
}: PatNavigationProps) {
  const [plotData, setPlotData] = useState<NavigationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  console.log("here:", applicationNumber)
  console.log("here2:", code)

  useEffect(() => {
    if (!applicationNumber || !code) return;
    setIsLoading(true);
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";

    fetch(`${API_BASE}/api/patent/navigate?appNumber=${applicationNumber}&code=${code}`)
      .then((res) => res.json())
      .then((data) => {
        const parsed = Array.isArray(data)
          ? data
          : typeof data === "string"
          ? JSON.parse(data)
          : [];
        setPlotData(parsed);
      })
      .catch((err) => console.error("API 오류:", err))
      .finally(() => setIsLoading(false));
  }, [applicationNumber, code]);

  // ✅ 로딩 상태
  if (isLoading)
    return (
      <div className="flex justify-center items-center h-60 text-zinc-500">
        <div className="animate-spin border-4 border-t-blue-500 border-gray-300 rounded-full h-8 w-8"></div>
        <span className="ml-3">데이터 불러오는 중...</span>
      </div>
    );

  // ✅ 데이터 없음
  if (!plotData.length)
    return (
      <p className="text-center text-zinc-400 py-10">
        특허 네비게이션 데이터가 없습니다.
      </p>
    );

  // ✅ 색상 및 크기 매핑
  const getColor = (item: NavigationData) => {
    if (item.date_type === 0) return "#2563eb"; // 내 특허 (파랑)
    if (item.score < 2 && item.score >= 1.85) return "#ef4444"; // 침해 가능성 높음 (빨강)
    return "#facc15"; // 기타 (노랑)
  };

  const scatterData = plotData.map((item) => ({
    ...item,
    color: getColor(item),
    size: item.date_type === 0 ? 100 : item.score < 2 ? 70 : 50,
  }));

  const myPatentCount = scatterData.filter((d) => d.date_type === 0).length;
  const riskCount = scatterData.filter((d) => d.score < 2 && d.score >= 1.85).length;
  const totalCount = scatterData.length;

    return (
        <section className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm p-8 mt-6">
            <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
                특허 네비게이션
            </h1>

            <div className="space-y-8 mt-8">
                {/* 요약 카드 */}
                <div className="grid md:grid-cols-3 gap-4">
                    <InfoCard
                    bg="bg-blue-50"
                    border="border-blue-200"
                    title="나의 특허"
                    color="text-blue-800"
                    value={`${myPatentCount}건`}
                    />
                    <InfoCard
                    bg="bg-red-50"
                    border="border-red-200"
                    title="침해 가능성 높은 특허"
                    color="text-red-800"
                    value={`${riskCount}건`}
                    />
                    <InfoCard
                    bg="bg-yellow-50"
                    border="border-yellow-200"
                    title="총 비교 대상"
                    color="text-yellow-800"
                    value={`${totalCount.toLocaleString()}건`}
                    />
                </div>

                {/* 차트 */}
                <div className="bg-white p-6 rounded-xl border border-zinc-200 shadow-sm">
                    <h3 className="font-semibold mb-4 text-zinc-700">🧭 특허 네비게이션 맵</h3>

                    <ResponsiveContainer width="100%" height={500}>
                    <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                        type="number"
                        dataKey="x_value"
                        name="유사도"
                        tick={false}
                        axisLine={false}
                        >
                        <Label value="1/유사도 →" offset={0} position="insideBottomRight" />
                        </XAxis>
                        <YAxis
                        type="number"
                        dataKey="y_value"
                        name="시간 흐름"
                        tick={false}
                        axisLine={false}
                        >
                        <Label value="↑ 시간" angle={-90} position="insideLeft" />
                        </YAxis>
                        <ZAxis dataKey="size" range={[30, 300]} />
                        <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        formatter={(value, name, props: any) => [
                            `${props.payload.application_number}`,
                            "출원번호",
                        ]}
                        contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            border: "1px solid #e5e7eb",
                        }}
                        />
                        <Scatter
                            data={scatterData}
                            fill="#2563eb"
                            shape={(props: any) => (
                                <circle
                                cx={props.cx}
                                cy={props.cy}
                                r={Math.sqrt(props.z || 60) / 2}
                                fill={(props.payload as any).color}
                                stroke="#fff"
                                strokeWidth={1}
                                />
                            )}
                            onClick={(e: any) => {
                                if (e?.application_number)
                                window.open(`/appNumber/${e.application_number}`, "_blank");
                            }}
                        />
                    </ScatterChart>
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
