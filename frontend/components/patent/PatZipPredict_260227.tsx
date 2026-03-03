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
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { patentByCitpredict } from "@/lib/api";

import {
  TrendingUp,     // 피인용수 예측 분석
} from "lucide-react";

type CitationPredictionChartProps = {
  applicationNumber: string;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-2">{data.label}</p>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-3 h-3 bg-blue-500 rounded-full" />
          <span className="text-zinc-600">누적 피인용수:</span>
          <span className="font-semibold text-zinc-900">{data.citation}회</span>
        </div>
        {data.isActual && (
          <div className="mt-1 text-xs text-green-600 font-medium">
            ✓ 실제 데이터
          </div>
        )}
        {data.isPredicted && (
          <div className="mt-1 text-xs text-blue-600 font-medium">
            ⚡ 예측 데이터
          </div>
        )}
      </div>
    );
  }
  return null;
};

// 그래프 라인에 화살표를 그리는 커스텀 컴포넌트
const LineWithArrow = ({ points, currentYear, chartData }: any) => {
  if (!points || points.length === 0) return null;

  const currentIdx = chartData.findIndex((d: any) => d.isActual);
  if (currentIdx === -1) return null;

  const isForward = currentYear <= 10;

  // 현재 연차 포인트와 다음 포인트 찾기
  const currentPoint = points[currentIdx];
  const nextIdx = isForward ? currentIdx + 1 : currentIdx - 1;

  if (!currentPoint || nextIdx < 0 || nextIdx >= points.length) return null;

  const nextPoint = points[nextIdx];

  // 두 점 사이의 중간 지점 계산
  const midX = (currentPoint.x + nextPoint.x) / 2;
  const midY = (currentPoint.y + nextPoint.y) / 2;

  // 화살표 방향 계산
  const angle = Math.atan2(nextPoint.y - currentPoint.y, nextPoint.x - currentPoint.x);
  const arrowSize = 10;

  return (
    <g>
      {/* 화살표 마커 */}
      <polygon
        points={`0,${-arrowSize / 2} ${arrowSize},0 0,${arrowSize / 2}`}
        fill="#06b6d4"
        transform={`translate(${midX},${midY}) rotate(${angle * 180 / Math.PI})`}
      />
    </g>
  );
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

    patentByCitpredict(applicationNumber)
      .then((data: any) => {
        if (data.error) {
          console.error("API 오류:", data.error);
          setCitationInfo(null);
          return;
        }
        setCitationInfo(data);
        prepareChartData(data);
      })
      .catch((err: any) => {
        console.error("API 호출 오류:", err);
        setCitationInfo(null);
      })
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  const prepareChartData = (data: any) => {
    const currentYear = data["연차수"];
    const yearlyPredictions = data["연도별_예측"] || [];

    // 10년 이하 특허
    if (currentYear <= 10) {
      // 현재 연차까지는 실제 데이터, 이후는 예측 데이터
      const chartPoints = yearlyPredictions.map((item: any) => ({
        year: item.year,
        citation: item.cumulative_citation,
        label: item.is_actual
          ? `${item.year}년차 (현재)`
          : `${item.year}년차 (예측)`,
        isActual: item.is_actual || false,
        isPredicted: !item.is_actual
      }));

      setChartData(chartPoints);
    }
    // 10년 이상 특허
    else {
      // 10년차부터 현재까지의 데이터
      const chartPoints = yearlyPredictions.map((item: any) => ({
        year: item.year,
        citation: item.cumulative_citation,
        label: item.is_actual
          ? `${item.year}년차 (현재)`
          : `${item.year}년차 (예측)`,
        isActual: item.is_actual || false,
        isPredicted: !item.is_actual
      }));

      setChartData(chartPoints);
    }
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

  if (!isLoading && !citationInfo) {
    return (
      <div className="bg-white p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header - 아이콘이 h1, p 태그 전체 높이를 포함하도록 구조 변경 */}
          <div className="mb-8 flex items-start gap-4">
            {/* 아이콘 크기를 두 줄 높이에 맞게 키움 (size={52~56 권장) */}
            <TrendingUp className="text-blue-600 shrink-0 mt-1" size={56} />
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">
                피인용수 예측 분석
              </h1>
              <p className="text-zinc-600">
                특허 인용 추세 및 10년차 예측
              </p>
            </div>
          </div>

          {/* 안내 박스 */}
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl py-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <p className="text-zinc-500 text-lg font-medium">
                피인용수 예측 데이터가 제공되지 않는 특허입니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentYear = citationInfo?.["연차수"] ?? 0;
  const currentCitation = citationInfo?.["현재_누적_피인용수"] ?? 0;
  // Math.round()를 제거하여 0.25와 같은 소수점 수치를 보존합니다.
  const predictedCitation = citationInfo?.["10년차_누적_피인용수"] ?? 0;

  // X축 범위 설정
  const xAxisDomain = [1, currentYear <= 10 ? 10 : currentYear];

  // 증가량 계산 (소수점 2자리까지)
  const absoluteGrowth = (predictedCitation - currentCitation).toFixed(2);

  // 증가율 계산 로직 수정
  // 현재 피인용수가 0보다 클 때만 %를 계산하고, 0일 때는 null을 반환하여 문구를 분기 처리합니다.
  const growthRate = currentYear <= 10 && currentCitation > 0
    ? (((predictedCitation - currentCitation) / currentCitation) * 100).toFixed(1)
    : null;

  return (
    <div className="bg-white py-10 px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header - 아이콘이 h1, p 태그 전체 높이를 포함하도록 구조 변경 */}
        <div className="mb-8 flex items-start gap-4">
          {/* 아이콘 크기를 두 줄 높이에 맞게 키움 (size={52~56 권장) */}
          <TrendingUp className="text-blue-600 shrink-0 mt-1" size={56} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">
              피인용수 예측 분석
            </h1>
            <p className="text-zinc-600">
              특허 인용 추세 및 10년차 예측
            </p>
          </div>
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
          <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-cyan-100">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-cyan-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">현재 연차</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {currentYear}년
              </div>
              <div className="text-xs text-zinc-500 mt-1">출원 후 경과 기간</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">현재 누적</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {currentCitation.toLocaleString()}회
              </div>
              <div className="text-xs text-zinc-500 mt-1">누적 피인용수</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">10년차 예측</span>
              </div>
              <div className="text-2xl font-bold text-emerald-600">
                {predictedCitation.toLocaleString()}회
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {currentYear <= 10 ? `+${predictedCitation}회 증가 예상` : "역산 추정값"}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              {currentYear <= 10 ? "피인용수 추이 및 예측" : "피인용수 역산 추정"}
            </h3>

            <div className="bg-white rounded-xl p-6 border border-zinc-100">
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={chartData}
                  margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
                >
                  <defs>
                    {/* 화살표 마커 정의 */}
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="10"
                      refX="5"
                      refY="5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 5, 0 10"
                        fill="#06b6d4"
                      />
                    </marker>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />

                  <XAxis
                    dataKey="year"
                    type="number"
                    domain={xAxisDomain}
                    ticks={Array.from(
                      { length: xAxisDomain[1] - xAxisDomain[0] + 1 },
                      (_, i) => xAxisDomain[0] + i
                    )}
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
                      value: "누적 피인용수",
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: '#3f3f46', fontWeight: 600 },
                      offset: 10,
                      dy: 50
                    }}
                  />

                  <Tooltip content={<CustomTooltip />} />

                  <Legend
                    wrapperStyle={{ paddingTop: '25px', paddingLeft: '50px' }}
                  />

                  {/* 메인 라인 */}
                  <Line
                    type="monotone"
                    dataKey="citation"
                    stroke="#06b6d4"
                    strokeWidth={3}
                    dot={(props: any) => {
                      const { cx, cy, payload, index } = props;

                      // 현재 연차 포인트
                      if (payload.isActual) {
                        const isForward = currentYear <= 10;
                        const currentIdx = chartData.findIndex((d: any) => d.isActual);
                        const nextIdx = isForward ? currentIdx + 1 : currentIdx - 1;

                        // 다음 포인트가 있는지 확인
                        if (nextIdx >= 0 && nextIdx < chartData.length) {
                          const nextData = chartData[nextIdx];
                          // 다음 포인트의 좌표를 대략적으로 계산 (recharts 내부 스케일 사용)
                          const xScale = (nextData.year - payload.year) * 50; // 대략적인 픽셀 거리
                          const nextX = isForward ? cx + xScale : cx - xScale;

                          return (
                            <g>
                              {/* 현재 연차 포인트 */}
                              <circle
                                cx={cx}
                                cy={cy}
                                r={8}
                                fill="#10b981"
                                stroke="#fff"
                                strokeWidth={2}
                              />

                              {/* 화살표 */}
                              <defs>
                                <marker
                                  id={`arrow-${index}`}
                                  markerWidth="6"
                                  markerHeight="6"
                                  refX="5"
                                  refY="2"
                                  orient="auto"
                                >
                                  <polygon
                                    points="0 0, 6 2, 0 4"
                                    fill="#06b6d4"
                                  />
                                </marker>
                              </defs>

                              {/* 화살표 라인 - 현재 포인트 바로 옆에서 시작 */}
                              <line
                                x1={isForward ? cx + 12 : cx - 12}
                                y1={cy}
                                x2={isForward ? cx + 35 : cx - 35}
                                y2={cy}
                                stroke="#06b6d4"
                                strokeWidth={2}
                                markerEnd={`url(#arrow-${index})`}
                              />
                            </g>
                          );
                        }

                        // 다음 포인트가 없으면 일반 포인트만
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={8}
                            fill="#10b981"
                            stroke="#fff"
                            strokeWidth={2}
                          />
                        );
                      }

                      // 예측 포인트
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#2563eb"
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                    name={currentYear <= 10 ? "예측 추세" : "역산 추정"}
                    activeDot={(props: any) => {
                      const { cx, cy, payload } = props;
                      return (
                        <circle
                          cx={cx}
                          cy={cy}
                          r={10}
                          fill={payload.isActual ? "#10b981" : "#2563eb"}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    }}
                  />

                  {/* 10년차 표시 라인 */}
                  <ReferenceLine
                    x={10}
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    label={{
                      value: "10년차",
                      position: "top",
                      fill: "#64748b",
                      fontSize: 12,
                      fontWeight: 600
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-8 mb-6 flex justify-center items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                <span className="text-zinc-600">실제 데이터</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                <span className="text-zinc-600">예측/추정 데이터</span>
              </div>
              <div className="flex items-center gap-2">
                <svg width="28" height="10" className="mt-0.5">
                  <defs>
                    <marker
                      id="legend-arrow"
                      markerWidth="6"
                      markerHeight="6"
                      refX="5"
                      refY="2"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 6 2, 0 4"
                        fill="#06b6d4"
                      />
                    </marker>
                  </defs>
                  <line
                    x1="0"
                    y1="5"
                    x2="28"
                    y2="5"
                    stroke="#06b6d4"
                    strokeWidth="2"
                    markerEnd="url(#legend-arrow)"
                  />
                </svg>
                <span className="text-zinc-600">
                  {currentYear <= 10 ? "예측 방향" : "역산 방향"}
                </span>
              </div>
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
                  {currentYear <= 10 ? (
                    <p className="text-sm text-blue-800 leading-relaxed">
                      현재 {currentYear}년차에 {currentCitation}회의 피인용수를 기록하고 있으며,
                      10년차까지 약 <strong className="text-blue-600">{predictedCitation}회</strong>로
                      증가할 것으로 예측됩니다.

                      {/* 증가량 및 증가율 표시 로직 */}
                      {growthRate ? (
                        <> 이는 현재 대비 약 <strong className="text-blue-600">{growthRate}%</strong> 증가한 수치입니다.</>
                      ) : (
                        <> 향후 약 <strong className="text-blue-600">{absoluteGrowth}회</strong>의 추가 인용이 발생할 것으로 전망됩니다.</>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-blue-800 leading-relaxed">
                      현재 {currentYear}년차에 {currentCitation}회의 피인용수를 기록하고 있으며,
                      역산 모델을 통해 10년차 시점의 누적 피인용수를 약 <strong className="text-blue-600">{predictedCitation}회</strong>로
                      추정합니다.
                    </p>
                  )}
                </div>
              </div>
            </div>


          </div>

          {/* Footer Note */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 {currentYear <= 10
                ? "예측 모델은 과거 인용 추세를 기반으로 미래 피인용수를 추정합니다."
                : "10년 이상 특허는 역산 모델을 통해 10년차 시점의 피인용수를 추정합니다."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}