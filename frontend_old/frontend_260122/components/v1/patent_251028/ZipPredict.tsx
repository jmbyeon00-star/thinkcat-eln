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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-2">{label}년차</p>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span className="text-zinc-600">예측 피인용수:</span>
          <span className="font-semibold text-zinc-900">{payload[0].value}회</span>
        </div>
      </div>
    );
  }
  return null;
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
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden animate-pulse">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="h-6 bg-blue-400 rounded w-32 mb-2"></div>
              <div className="h-4 bg-blue-300 rounded w-48"></div>
            </div>
            <div className="p-8">
              <div className="grid grid-cols-3 gap-6 mb-8">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-zinc-100 rounded-xl"></div>
                ))}
              </div>
              <div className="h-96 bg-zinc-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!citationInfo) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-lg">피인용수 예측 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const currentYear = citationInfo?.["연차수"] ?? 0;
  const currentCitation = citationInfo?.["현재 누적 피인용수"] ?? 0;
  const predictedCitation = citationInfo?.["10년차 누적 피인용수"] ?? 0;
  const growthRate = currentCitation > 0
    ? (((predictedCitation - currentCitation) / currentCitation) * 100).toFixed(1)
    : "0";

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            피인용수 예측 분석
          </h1>
          <p className="text-zinc-600">
            특허 인용 추세 및 10년차 예측
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              인용 추세 분석
            </h2>
            <p className="text-blue-100 text-sm">
              Citation Trend Analysis & Prediction
            </p>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">현재 연차</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {currentYear}년
              </div>
              <div className="text-xs text-zinc-500 mt-1">출원 후 경과 기간</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-cyan-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">현재 누적</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {currentCitation.toLocaleString()}회
              </div>
              <div className="text-xs text-zinc-500 mt-1">누적 피인용수</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">10년차 예측</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {Math.round(predictedCitation).toLocaleString()}회
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                +{growthRate}% 증가 예상
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              피인용수 추이 예측
            </h3>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
                >
                  <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#2563eb" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />

                  <XAxis
                    dataKey="year"
                    tick={{ fill: '#52525b', fontSize: 12 }}
                    label={{
                      value: "연차 (년)",
                      position: "insideBottom",
                      offset: -10,
                      style: { fill: '#3f3f46', fontWeight: 600 }
                    }}
                  />

                  <YAxis
                    tick={{ fill: '#52525b', fontSize: 12 }}
                    label={{
                      value: "누적 피인용수 (회)",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: '#3f3f46', fontWeight: 600 }
                    }}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Legend
                    wrapperStyle={{ paddingTop: '10px' }}
                  />

                  <Line
                    type="monotone"
                    dataKey="citation"
                    stroke="url(#lineGradient)"
                    strokeWidth={3}
                    dot={false}
                    name="예측 추세"
                    activeDot={{ r: 6 }}
                  />

                  <ReferenceDot
                    x={currentYear}
                    y={currentCitation}
                    r={8}
                    fill="#1e40af"
                    stroke="#fff"
                    strokeWidth={2}
                    label={{
                      value: "현재",
                      position: "top",
                      fill: "#1e40af",
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  />

                  <ReferenceDot
                    x={10}
                    y={Math.round(predictedCitation)}
                    r={8}
                    fill="#059669"
                    stroke="#fff"
                    strokeWidth={2}
                    label={{
                      value: "10년차",
                      position: "top",
                      fill: "#059669",
                      fontWeight: 600,
                      fontSize: 12
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Insight Box */}
            <div className="mt-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500 text-white rounded-full p-2 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">예측 인사이트</h4>
                  <p className="text-sm text-blue-800 leading-relaxed">
                    현재 {currentYear}년차에 {currentCitation}회의 피인용수를 기록하고 있으며,
                    10년차까지 약 <strong className="text-blue-600">{Math.round(predictedCitation).toLocaleString()}회</strong>로
                    증가할 것으로 예측됩니다. 이는 현재 대비 약 <strong className="text-blue-600">{growthRate}%</strong>
                    증가한 수치입니다.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 예측 모델은 과거 인용 추세를 기반으로 미래 피인용수를 추정합니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}