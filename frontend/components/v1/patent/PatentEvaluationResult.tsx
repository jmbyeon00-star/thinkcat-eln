import { useEffect, useState } from "react";
import { getPatentPrice } from "@/lib/api"; 
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-1">
          {payload[0].payload.subject}
        </p>
        <p className="text-sm text-zinc-600">
          점수: <span className="font-semibold text-blue-600">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function PatentEvaluationResult({
  appNumber,
}: PatentEvaluationResultProps) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

      // ✅ 디버깅 로그 추가
    console.log("=== PatentEvaluationResult ===");
    console.log("Received appNumber:", appNumber);
    console.log("Type:", typeof appNumber);
    console.log("Length:", appNumber?.length);
    console.log("============================");


useEffect(() => {
  if (!appNumber) return;

  setLoading(true);
  setError(null);

  getPatentPrice(appNumber)
    .then((d) => {
      setData(d);
      // console.log(d);
    })
    .catch((e) => setError(e.message))
    .finally(() => setLoading(false));
}, [appNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden animate-pulse">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="h-6 bg-blue-400 rounded w-32 mb-2"></div>
              <div className="h-4 bg-blue-300 rounded w-48"></div>
            </div>
            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-zinc-100 rounded"></div>
                  ))}
                </div>
                <div className="h-80 bg-zinc-100 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-lg">특허평가 예측 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-lg">평가 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const rows = [
    { name: "기술", value: data.tech, color: "#3b82f6" },
    { name: "법률", value: data.legal, color: "#8b5cf6" },
    { name: "시장", value: data.market, color: "#06b6d4" },
    { name: "경제", value: data.economy, color: "#10b981" },
    { name: "전략", value: data.strategy, color: "#f59e0b" },
  ];

  const chartData = rows.map((r) => ({
    subject: r.name,
    score: r.value,
  }));

  const formatPrice = (n?: number | string) =>
    n ? new Intl.NumberFormat().format(Number(n)) : "-";

  const totalScore = rows.reduce((sum, r) => sum + r.value, 0);
  const avgScore = (totalScore / rows.length).toFixed(1);

  // console.log(data)

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            특허 가치 평가
          </h1>
          <p className="text-zinc-600">
            5개 영역 종합 분석 및 가격 예측
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              평가 결과
            </h2>
            <p className="text-blue-100 text-sm">
              Patent Valuation Result
            </p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">평균 점수</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {avgScore}점
              </div>
              <div className="text-xs text-zinc-500 mt-1">5개 영역 평균</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">예측 가격</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                ₩{formatPrice(data.predicted_price)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">AI 예측 결과</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">실제 가격</span>
                </div>
                <div className="text-2xl font-bold text-zinc-900">
                  {data.real_price != null && !isNaN(Number(data.real_price))
                    ? `₩${formatPrice(data.real_price)}`
                    : <span className="text-zinc-400">정보없음</span>
                  }
                </div>
              <div className="text-xs text-zinc-500 mt-1">거래 실거래가</div>
            </div>
          </div>

          {/* Content Area */}
          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Score Table */}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                  세부 평가 항목
                </h3>
                <div className="space-y-3">
                  {rows.map((r) => (
                    <div 
                      key={r.name}
                      className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100 hover:border-zinc-200 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: r.color }}
                          />
                          <span className="text-sm font-medium text-zinc-700">
                            {r.name}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-zinc-900">
                          {r.value}점
                        </span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${r.value}%`,
                            backgroundColor: r.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar Chart */}
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                  <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                  종합 평가 차트
                </h3>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                  <ResponsiveContainer width="100%" height={320}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                      <PolarGrid stroke="#cbd5e1" />
                      <PolarAngleAxis 
                        dataKey="subject"
                        tick={{ fill: '#52525b', fontSize: 12, fontWeight: 600 }}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Radar
                        name="평가점수"
                        dataKey="score"
                        stroke="#2563eb"
                        fill="#2563eb"
                        fillOpacity={0.5}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 평가 점수는 기술, 법률, 시장, 경제, 전략 5개 영역을 종합 분석한 결과입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}