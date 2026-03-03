"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import {
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
} from "recharts";
import { patentByNavigate } from "@/lib/api";

import {
  Compass,
} from "lucide-react";

type NavigationData = {
  application_number: string;
  filing_date?: string;
  x_value: number;
  y_value: number;
  score: number;
  date_type: number;
};

type PatNavigationProps = {
  applicationNumber: string;
  code: string;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;

    const formatDate = (dateString?: string) => {
      if (!dateString) return null;
      return dateString.split("T")[0];
    };

    const isMyPatent = data.date_type === 0 && data.original_x === 0.0;
    const isHighSimilar = !isMyPatent && data.original_x <= 0.85;

    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-2">특허 정보</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">출원번호:</span>
            <span className="font-semibold text-zinc-900">{data.application_number}</span>
          </div>
          {data.filing_date && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-600">출원일자:</span>
              <span className="font-semibold text-zinc-900">{formatDate(data.filing_date)}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-zinc-600">
              {isMyPatent ? "나의 특허" : isHighSimilar ? "고유사 특허" : "기타 특허"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function PatNavigationChart({ applicationNumber, code }: PatNavigationProps) {
  const router = useRouter();
  const [plotData, setPlotData] = useState<NavigationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = (applicationNum: string) => {
    if (applicationNum) {
      router.push(`/applicationNum/${applicationNum}`);
    }
  };

  useEffect(() => {
    if (!applicationNumber || !code) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await patentByNavigate(applicationNumber, code);
        if (!Array.isArray(data)) throw new Error("응답 형식이 올바르지 않습니다.");
        setPlotData(data);
      } catch (err: any) {
        console.error("데이터 로드 실패:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [applicationNumber, code]);

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
              <div className="h-[500px] bg-zinc-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!plotData.length) {
    return (
      <div className="bg-white py-10 px-8">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8 flex items-start gap-4">
            <Compass className="text-blue-600 shrink-0 mt-1" size={56} />
            <div className="flex flex-col">
              <h1 className="text-3xl font-bold text-zinc-900 mb-2">특허 네비게이션 분석</h1>
              <p className="text-zinc-600">유사 특허 분포 및 근접도 시각화</p>
            </div>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl py-12 text-center shadow-sm">
            <p className="text-zinc-500 text-lg font-medium">특허 네비게이션 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  // ✅ original_x 보존 후, 카테고리별로 x 위치를 명확히 분리
  const scatterData = plotData.map((item) => {
    const isMyPatent = item.date_type === 0 && item.x_value === 0.0;
    const isHighSimilar = !isMyPatent && item.x_value <= 0.85;

    let displayX: number;
    if (isMyPatent) {
      displayX = 0.0; // 나의 특허: 맨 왼쪽 고정
    } else if (isHighSimilar) {
      // 고유사 특허: 0.2 ~ 0.4 구간에 매핑
      displayX = 0.2 + (item.x_value / 0.85) * 0.2;
    } else {
      // 기타 특허: 0.45 ~ 0.65 구간에 매핑
      displayX = 0.45 + ((item.x_value - 0.85) / 0.15) * 0.2;
    }

    const color = isMyPatent ? "#2563eb" : isHighSimilar ? "#ef4444" : "#f59e0b";
    const size = isMyPatent ? 300 : isHighSimilar ? 180 : 80;

    return {
      ...item,
      original_x: item.x_value,
      x_value: displayX,
      color,
      size,
      isMyPatent,
      isHighSimilar,
    };
  });

  const highSimilarityCount = scatterData.filter((d) => d.isHighSimilar).length;
  const totalCount = scatterData.length;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-start gap-4">
          <Compass className="text-blue-600 shrink-0 mt-1" size={56} />
          <div className="flex flex-col">
            <h1 className="text-3xl font-bold text-zinc-900 mb-2">특허 네비게이션 분석</h1>
            <p className="text-zinc-600">유사 특허 분포 및 근접도 시각화</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">특허 포지셔닝 맵</h2>
            <p className="text-blue-100 text-sm">Patent Navigation & Positioning Map</p>
          </div>

          <div className="p-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              특허 분포 시각화
            </h3>

            <div className="bg-white rounded-xl p-6 border border-gray-100">
              <div className="relative">
                <ResponsiveContainer width="100%" height={500}>
                  <ScatterChart margin={{ top: 30, right: 80, bottom: 40, left: 40 }}>
                    <defs>
                      <pattern id="bg-pattern" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                        <image
                          href="/images/semicircle-bg.svg"
                          x="100"
                          y="0"
                          width="calc(100% - 50px)"
                          height="100%"
                          opacity="0.3"
                          preserveAspectRatio="none"
                        />
                      </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern)" />

                    <CartesianGrid stroke="none" />

                    <ReferenceLine
                      y={0}
                      stroke="#d4d4d8"
                      strokeWidth={2}
                      label={{
                        value: "1/유사도 →",
                        position: "right",
                        fill: "#3f3f46",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    />

                    <XAxis
                      type="number"
                      dataKey="x_value"
                      domain={[0, 0.75]}
                      hide={true}
                    />

                    <YAxis
                      type="number"
                      dataKey="y_value"
                      domain={[-1, 1]}
                      ticks={[]}
                      axisLine={{ stroke: "#d4d4d8" }}
                      tickLine={false}
                    />

                    {/* ✅ ZAxis range를 size 값에 맞게 좁힘 */}
                    <ZAxis dataKey="size" range={[80, 500]} />

                    <Tooltip content={<CustomTooltip />} />

                    <Scatter
                      data={scatterData}
                      shape={(props: any) => {
                        const payload = props.payload;

                        // ✅ baseSize 중복 적용 제거 - 한 번만 계산
                        // ZAxis 의존 제거 - 카테고리별 고정 픽셀 크기
                        let baseSize: number;
                        let iconPath: string;
                        if (payload.isMyPatent) {
                          baseSize = 36; // 나의 특허: 72px
                          iconPath = "/images/car-blue.svg";
                        } else if (payload.isHighSimilar) {
                          baseSize = 24; // 고유사 특허: 48px
                          iconPath = "/images/car-red.svg";
                        } else {
                          baseSize = 14; // 기타 특허: 28px
                          iconPath = "/images/car-yellow.svg";
                        }

                        return (
                          <image
                            x={props.cx - baseSize}
                            y={props.cy - baseSize}
                            width={baseSize * 2}
                            height={baseSize * 2}
                            href={iconPath}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.15))" }}
                          />
                        );
                      }}
                      onClick={(e: any) => {
                        if (e?.application_number) handleClick(e.application_number);
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>

                <div className="absolute left-0 top-0" style={{ marginTop: "20px", marginLeft: "40px" }}>
                  <span className="text-sm font-semibold text-zinc-700" style={{ fontSize: 13 }}>↑ 시간</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-6 justify-center">
              <div className="flex items-center gap-2">
                <img src="/images/car-blue.svg" alt="파란 자동차" className="w-6 h-6" />
                <span className="text-sm text-zinc-700">나의 특허</span>
              </div>
              <div className="flex items-center gap-2">
                <img src="/images/car-red.svg" alt="빨간 자동차" className="w-6 h-6" />
                <span className="text-sm text-zinc-700">고유사 특허</span>
              </div>
              <div className="flex items-center gap-2">
                <img src="/images/car-yellow.svg" alt="노란 자동차" className="w-6 h-6" />
                <span className="text-sm text-zinc-700">기타 특허</span>
              </div>
            </div>

            <div className="mt-6 bg-gradient-to-r from-red-50 to-orange-50 rounded-xl p-5 border border-red-100">
              <div className="flex items-start gap-3">
                <div className="bg-red-500 text-white rounded-full p-2 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">유사 특허 알림</h4>
                  <p className="text-sm text-red-800 leading-relaxed">
                    총 <strong className="text-red-600">{totalCount.toLocaleString()}건</strong>의 특허 중{" "}
                    <strong className="text-red-600">{highSimilarityCount}건</strong>이 높은 유사도를 보이며 면밀한 검토가 필요합니다.
                    자동차 아이콘을 클릭하여 상세 페이지를 확인하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}