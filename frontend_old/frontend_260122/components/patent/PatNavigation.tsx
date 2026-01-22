import { useEffect, useState } from "react";
import { useRouter } from "next/router";
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
  ReferenceLine,
} from "recharts";
import { patentByNavigate } from "@/lib/api"; 

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
    
    // filing_date 포맷팅 (YYYY-MM-DDTHH:mm:ss -> YYYY-MM-DD)
    const formatDate = (dateString?: string) => {
      if (!dateString) return null;
      return dateString.split('T')[0];
    };
    
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
              {(data.date_type === 0 && data.x_value === 0.0)
                ? "나의 특허" 
                : (data.x_value >= 0 && data.x_value <= 0.425)
                  ? "침해 가능성 높음" 
                  : "기타 특허"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function PatNavigationChart({applicationNumber,code}: PatNavigationProps) {
  const router = useRouter();
  const [plotData, setPlotData] = useState<NavigationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = (applicationNum: string) => {
    if (applicationNum) {
      router.push(`/search/applicationNum/${applicationNum}`);
    }
  };

  useEffect(() => {
    if (!applicationNumber || !code) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const data = await patentByNavigate(applicationNumber, code);

        if (!Array.isArray(data)) {
          throw new Error("응답 형식이 올바르지 않습니다.");
        }

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
              <div className="grid grid-cols-3 gap-6 mb-8">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-zinc-100 rounded-xl"></div>
                ))}
              </div>
              <div className="h-[500px] bg-zinc-100 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!plotData.length) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-8 text-center">
            <p className="text-zinc-500 text-lg">특허 네비게이션 데이터가 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  const getColor = (item: NavigationData) => {
    // 나의 기준 특허: date_type === 0 이면서 x_value === 0.0
    if (item.date_type === 0 && item.x_value === 0.0) return "#2563eb";
    // 침해 위험: x_value가 0~0.85 사이 (2로 나눈 값 기준 0~0.425)
    if (item.x_value / 2 >= 0 && item.x_value / 2 <= 0.425) return "#ef4444";
    return "#facc15";
  };

  const scatterData = plotData.map((item) => ({
    ...item,
    // 침해 위험 특허는 0점 쪽으로 이동 (0.15 빼기)
    x_value: (item.x_value / 2 >= 0 && item.x_value / 2 <= 0.425 && !(item.date_type === 0 && item.x_value === 0.0))
      ? item.x_value / 2 - 0.15
      : item.x_value / 2,
    color: getColor(item),
    size: (item.date_type === 0 && item.x_value === 0.0) 
      ? 200 // 나의 특허: 가장 큼
      : (item.x_value / 2 >= 0 && item.x_value / 2 <= 0.425) 
        ? 90 // 침해 위험: 중간 크기 (70에서 90으로 증가)
        : 50, // 기타: 작음
  }));

  const myPatentCount = scatterData.filter((d) => d.date_type === 0 && d.x_value === 0.0).length;
  const riskCount = scatterData.filter((d) => d.x_value >= 0 && d.x_value <= 0.425 && !(d.date_type === 0 && d.x_value === 0.0)).length;
  const totalCount = scatterData.length;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            특허 네비게이션 분석
          </h1>
          <p className="text-zinc-600">
            유사 특허 분포 및 침해 가능성 시각화
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              특허 포지셔닝 맵
            </h2>
            <p className="text-blue-100 text-sm">
              Patent Navigation & Positioning Map
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">나의 특허</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {myPatentCount}건
              </div>
              <div className="text-xs text-zinc-500 mt-1">기준 특허</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-red-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-red-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">침해 위험</span>
              </div>
              <div className="text-2xl font-bold text-red-600">
                {riskCount}건
              </div>
              <div className="text-xs text-zinc-500 mt-1">높은 유사도</div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-yellow-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">기타 비교</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {(totalCount - riskCount - 1).toLocaleString()}건
              </div>
              <div className="text-xs text-zinc-500 mt-1">기타 특허</div>
            </div>
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
                    {/* SVG 배경 이미지 */}
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
                    
                    {/* Y=0 위치에 X축 (수평선) */}
                    <ReferenceLine 
                      y={0} 
                      stroke="#d4d4d8" 
                      strokeWidth={2}
                      label={{ 
                        value: "1/유사도 →", 
                        position: "right",
                        fill: '#3f3f46',
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    />
                    
                    <XAxis
                      type="number"
                      dataKey="x_value"
                      domain={[0, 1]}
                      hide={true}
                    />
                    
                    <YAxis
                      type="number"
                      dataKey="y_value"
                      domain={[-1, 1]}
                      ticks={[]}
                      axisLine={{ stroke: '#d4d4d8' }}
                      tickLine={false}
                    />
                    
                    <ZAxis dataKey="size" range={[30, 300]} />
                    
                    <Tooltip content={<CustomTooltip />} />
                    
                    <Scatter
                      data={scatterData}
                      fill="#2563eb"
                      shape={(props: any) => {
                        const payload = props.payload as any;
                        
                        // 자동차 크기 조정
                        let baseSize = Math.sqrt(props.z || 60) / 0.55;
                        if (payload.date_type === 0 && payload.x_value === 0.0) {
                          baseSize = baseSize * 1.8; // 나의 특허는 1.8배 크게
                        } else if (payload.x_value >= -0.15 && payload.x_value <= 0.275) {
                          // 침해 위험 특허 (0.425 - 0.15 = 0.275)
                          baseSize = baseSize * 1.3; // 침해 위험은 1.3배 크게
                        }
                        
                        // 나의 기준 특허는 파란 자동차, 침해 위험은 빨간 자동차, 나머지는 노란 자동차
                        let iconPath = '/images/car-yellow.svg';
                        if (payload.date_type === 0 && payload.x_value === 0.0) {
                          iconPath = '/images/car-blue.svg';
                        } else if (payload.x_value >= -0.15 && payload.x_value <= 0.275) {
                          iconPath = '/images/car-red.svg';
                        }
                        
                        return (
                          <image
                            x={props.cx - baseSize}
                            y={props.cy - baseSize}
                            width={baseSize * 2}
                            height={baseSize * 2}
                            href={iconPath}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
                          />
                        );
                      }}
                      onClick={(e: any) => {
                        if (e?.application_number) {
                          handleClick(e.application_number);
                        }
                      }}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
                
                {/* Y축 라벨 */}
              <div className="absolute left-0 top-0" style={{ marginTop: '20px', marginLeft: '40px' }}>
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
                <img src="/images/car-red.svg" alt="노란 자동차" className="w-6 h-6" />
                <span className="text-sm text-zinc-700">침해위험 특허</span>
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
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">침해 위험 알림</h4>
                  <p className="text-sm text-red-800 leading-relaxed">
                    총 <strong className="text-red-600">{totalCount.toLocaleString()}건</strong>의 특허 중 
                    <strong className="text-red-600"> {riskCount}건</strong>이 높은 유사도를 보이며 잠재적 침해 가능성이 있습니다. 
                    자동차 아이콘을 클릭하여 상세 분석을 진행하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 자동차 아이콘을 클릭하면 해당 특허의 상세 정보를 확인할 수 있습니다. 아이콘의 크기는 중요도를 나타냅니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}