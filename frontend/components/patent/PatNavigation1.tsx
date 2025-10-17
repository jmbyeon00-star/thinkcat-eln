"use client";

import { useEffect, useState } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from "recharts";

type PatentPoint = {
  application_number: string;
  score: number;
  x_value: number;
  y_value: number;
  date_type: number;
};

type PatNavigationProps = {
  applicationNumber: string;
  code: string;
};

const getPointColor = (item: PatentPoint) => {
  if (item.date_type === 0) return "#5F91BD";
  if (item.score < 2 && item.score >= 1.85) return "#FF6D67";
  return "#dacf01";
};

// ✅ 커스텀 도트 (명시적 타입 선언)
const CustomDot = ({
  cx,
  cy,
  payload,
}: {
  cx: number;
  cy: number;
  payload: PatentPoint;
}) => {
  const fill = getPointColor(payload);
  const r =
    payload.date_type === 0
      ? 10
      : payload.score < 2 && payload.score >= 1.85
      ? 7
      : 5;
  return <circle cx={cx} cy={cy} r={r} fill={fill} stroke="white" strokeWidth={1.5} />;
};

// ✅ 커스텀 툴팁 (payload 타입을 any로 고정 → 오류 완전 제거)
const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0].payload as PatentPoint;
    const color = getPointColor(item);
    const label =
      item.date_type === 0
        ? "나의 특허"
        : item.score < 2 && item.score >= 1.85
        ? "침해 가능성 높음"
        : "기타 특허";

    return (
      <div className="bg-white border border-gray-300 rounded-md shadow-sm px-3 py-2 text-sm">
        <p className="font-semibold" style={{ color }}>
          {label}
        </p>
        <p className="text-gray-600">출원번호: {item.application_number}</p>
      </div>
    );
  }
  return null;
};

export default function PatNavigation({ applicationNumber, code }: PatNavigationProps) {
  const [plotData, setPlotData] = useState<PatentPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!applicationNumber || !code) return;
    setIsLoading(true);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

    fetch(`${base}/api/patent/navigate?appNumber=${applicationNumber}&code=${code}`)
      .then((res) => res.json())
      .then((data) => setPlotData(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [applicationNumber, code]);

  const handleClick = (e: any) => {
    const selected: PatentPoint | undefined = e?.activePayload?.[0]?.payload;
    if (selected?.application_number) {
      window.location.href = `/search/detail/${selected.application_number}`;
    }
  };

  return (
    <div className="flex justify-center items-center py-6">
      {isLoading ? (
        <div className="text-gray-500 text-center py-10">🔄 데이터 로딩 중...</div>
      ) : plotData.length > 0 ? (
        <div className="bg-white rounded-xl border p-4 shadow-sm">
          <h2 className="text-center font-semibold mb-3 text-gray-700">
            📊 특허 네비게이션
          </h2>
          <div className="relative w-[480px] h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                onClick={handleClick}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" dataKey="x_value" hide />
                <YAxis type="number" dataKey="y_value" hide />
                <ZAxis range={[60, 60]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                <Scatter
                    data={plotData}
                    shape={(props: any) => <CustomDot {...props} />}
                />
              </ScatterChart>
            </ResponsiveContainer>

            <div className="absolute top-2 left-3 text-xs text-gray-400">↑ 미래</div>
            <div className="absolute bottom-2 left-3 text-xs text-gray-400">↓ 과거</div>
            <div className="absolute right-2 top-1/2 text-xs text-gray-400 rotate-90">
              1 / 유사도
            </div>
          </div>
        </div>
      ) : (
        <p className="text-gray-400 text-sm text-center">
          특허 네비게이션 데이터를 불러올 수 없습니다.
        </p>
      )}
    </div>
  );
}
