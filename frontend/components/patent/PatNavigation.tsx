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

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-zinc-200">
        <p className="text-sm font-semibold text-zinc-700 mb-2">특허 정보</p>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-600">출원번호:</span>
            <span className="font-semibold text-zinc-900">{data.application_number}</span>
          </div>
          <div className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: data.color }}
            />
            <span className="text-zinc-600">
              {data.date_type === 0 
                ? "나의 특허" 
                : data.score < 2 
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

export default function PatNavigationChart({
  applicationNumber,
  code,
}: PatNavigationProps) {
  const [plotData, setPlotData] = useState<NavigationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!applicationNumber || !code) return;
    setIsLoading(true);
    const API_BASE = "http://192.168.1.20:8000";

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
    if (item.date_type === 0) return "#2563eb";
    if (item.score < 2 && item.score >= 1.85) return "#ef4444";
    return "#facc15";
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
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            특허 네비게이션 분석
          </h1>
          <p className="text-zinc-600">
            유사 특허 분포 및 침해 가능성 시각화
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              특허 포지셔닝 맵
            </h2>
            <p className="text-blue-100 text-sm">
              Patent Navigation & Positioning Map
            </p>
          </div>

          {/* Stats Summary */}
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
                <span className="text-sm font-medium text-zinc-700">전체 비교</span>
              </div>
              <div className="text-2xl font-bold text-zinc-900">
                {totalCount.toLocaleString()}건
              </div>
              <div className="text-xs text-zinc-500 mt-1">비교 대상</div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-8">
            <h3 className="text-lg font-semibold text-zinc-900 mb-6 flex items-center gap-2">
              <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              특허 분포 시각화
            </h3>

            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
              <ResponsiveContainer width="100%" height={500}>
                <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  
                  <XAxis
                    type="number"
                    dataKey="x_value"
                    name="유사도"
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={{ stroke: '#d4d4d8' }}
                  >
                    <Label 
                      value="1/유사도 →" 
                      offset={0} 
                      position="insideBottomRight"
                      style={{ fill: '#3f3f46', fontWeight: 600, fontSize: 12 }}
                    />
                  </XAxis>
                  
                  <YAxis
                    type="number"
                    dataKey="y_value"
                    name="시간 흐름"
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    axisLine={{ stroke: '#d4d4d8' }}
                  >
                    <Label 
                      value="↑ 시간" 
                      angle={-90} 
                      position="insideLeft"
                      style={{ fill: '#3f3f46', fontWeight: 600, fontSize: 12 }}
                    />
                  </YAxis>
                  
                  <ZAxis dataKey="size" range={[30, 300]} />
                  
                  <Tooltip content={<CustomTooltip />} />
                  
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
                        strokeWidth={2}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
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

            {/* Legend */}
            <div className="mt-6 flex flex-wrap gap-6 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow"></div>
                <span className="text-sm text-zinc-700">나의 특허 (파랑)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow"></div>
                <span className="text-sm text-zinc-700">침해 가능성 높음 (빨강)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-yellow-400 rounded-full border-2 border-white shadow"></div>
                <span className="text-sm text-zinc-700">기타 특허 (노랑)</span>
              </div>
            </div>

            {/* Insight Box */}
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
                    빨간색으로 표시된 특허들을 클릭하여 상세 분석을 진행하세요.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 원을 클릭하면 해당 특허의 상세 정보를 확인할 수 있습니다. 원의 크기는 중요도를 나타냅니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}