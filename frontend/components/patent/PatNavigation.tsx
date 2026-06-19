"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
} from "recharts";
// ✅ 새로운 GPU 서버 호출 함수로 변경
import { getPatentNavigationGpu } from "@/lib/api"; 
import { Compass, AlertCircle } from "lucide-react";

type NavigationData = {
  application_number: string;
  filing_date?: string;
  x_value: number;
  y_value: number;
  score: number;
  date_type: number;
  cpc_code?: string; // ✅ 추가된 CPC 데이터 대응
};

type PatNavigationProps = {
  applicationNumber: string;
  code: string;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formatDate = (dateString?: string) => dateString ? dateString.split("T")[0] : null;

    return (
      <div className="bg-white px-4 py-3 rounded-xl shadow-xl border border-slate-100">
        <p className="text-xs font-black text-slate-400 uppercase mb-2">특허 정보 상세</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">출원번호:</span>
            <span className="font-bold text-slate-900">{data.application_number}</span>
          </div>
          {data.filing_date && (
            <div className="flex items-center gap-2">
              <span className="text-slate-500 font-medium">출원일자:</span>
              <span className="font-bold text-slate-900">{formatDate(data.filing_date)}</span>
            </div>
          )}

          <div className="pt-1 mt-1 border-t border-slate-50 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="font-black" style={{ color: data.color }}>
              {data.isMyPatent ? "나의 특허" : data.isHighSimilar ? "고유사 특허" : "기타 특허"}
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

  const handleClick = (applicationNum: string) => {
    if (applicationNum) router.push(`/applicationNum/${applicationNum}`);
  };

  useEffect(() => {
    if (!applicationNumber || !code) return;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // ✅ 8001 GPU 서버 전용 API 호출
        const data = await getPatentNavigationGpu(applicationNumber, code);
        
        // 백엔드에서 리스트를 바로 반환하므로 Array.isArray로 체크
        if (Array.isArray(data)) {
          setPlotData(data);
        }
      } catch (err) {
        console.error("GPU 데이터 로드 실패:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [applicationNumber, code]);

  if (isLoading) return <div className="w-full h-96 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;

  if (!plotData.length) {
    return (
      <div className="w-full p-20 text-center bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
        <Compass className="text-slate-200 mx-auto mb-4" size={48} />
        <p className="text-slate-400 font-bold">특허 네비게이션 데이터가 없습니다.</p>
      </div>
    );
  }

  const comparisonData = plotData.filter(
    (item) => !(item.date_type === 0 && item.x_value === 0.0)
  );
  const sortedBySimilarity = [...comparisonData].sort(
    (a, b) => b.score - a.score
  );
  const top2Set = new Set(
    sortedBySimilarity.slice(0,2).map((d) => d.application_number)
  );

  const scatterData = plotData.map((item) => {
      // 1. 나의 특허 판별 (x_value가 0인 기준점)
      const isMyPatent = item.date_type === 0 && item.x_value === 0.0;

      // 2. 고유사 특허 판별 기준 수정 (0.5 -> 0.95)
      // ✅ score가 0.95 이상인 것만 빨간색(isHighSimilar)으로 설정
      // const isHighSimilar = !isMyPatent && item.score >= 0.95; 
      const isHighSimilar = !isMyPatent && top2Set.has(item.application_number);

      // 3. 차트상 X축 디스플레이 위치 계산 (이전 로직 유지)
      let displayX: number;
      if (isMyPatent) {
        displayX = 0.0;
      } else if (isHighSimilar) {
        // 고유사 영역 (원점 근처 배치)
        displayX = 0.0 + (item.x_value * 0.7); 
      } else {
        // 기타 영역 (멀리 배치)
        displayX = 0.0 + (item.x_value * 1);

      }

      // 4. 색상 결정 (빨간색: #ef4444, 노란색: #f59e0b)
      const color = isMyPatent ? "#2563eb" : isHighSimilar ? "#ef4444" : "#f59e0b";

      return { 
        ...item, 
        original_x: item.x_value, 
        x_value: displayX, 
        color, 
        isMyPatent, 
        isHighSimilar 
      };
    });

  const totalCount = scatterData.length;
  const highSimilarityCount = scatterData.filter((d) => d.isHighSimilar).length;

  return (
    <div className="w-full text-left font-sans">
      {/* ... (이하 JSX 레이아웃 코드는 동일하므로 생략) ... */}
      <div className="mb-8 flex items-start gap-4">
        <Compass className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            특허 네비게이션 분석
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            GPU 가속 기반 유사 특허 분포 시각화
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <h2 className="text-2xl font-black text-white tracking-tighter">특허 포지셔닝 맵</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
              Patent Navigation & Positioning Map (Powered by GPU)
            </p>
        </div>

        <div className="p-8 space-y-6">
          <SectionTitle title="특허 분포 시각화" />
        <div className="bg-white rounded-[2rem] border border-slate-100 p-0 relative overflow-hidden h-[500px]">
          {/* 레이블 가이드 */}
          <div className="absolute left-[30px] top-10 z-20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded border border-slate-100 shadow-sm backdrop-blur-sm">↑ 시간</span>
          </div>

          <div className="absolute right-[30px] top-1/2 -translate-y-1/2 mt-1.5 z-20">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded border border-slate-100 shadow-sm backdrop-blur-sm">
              유사도 감소 →
            </span>
          </div>

          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 40, right: 160, bottom: 40, left: 40 }}>
              {/* 1. 패턴 정의 */}
              <defs>
                <pattern 
                  id="semicircle-bg" 
                  x="-1%" 
                  y="0" 
                  width="105%" 
                  height="100%" 
                  patternUnits="userSpaceOnUse"
                >
                  <image 
                    href="/images/semicircle-bg.svg" 
                    x="0" 
                    y="0" 
                    width="100%" 
                    height="100%" 
                    preserveAspectRatio="none" 
                    style={{ opacity: 0.15 }} 
                  />
                </pattern>
              </defs>

              {/* 2. 배경 사각형 적용 (데이터 요소들보다 먼저 선언해야 뒤로 깔립니다) */}
              {/* width/height를 200%로 넉넉히 잡아 마진 밖까지 채웁니다 */}
              <rect 
                x="-50%" 
                y="-50%" 
                width="200%" 
                height="200%" 
                fill="url(#semicircle-bg)" 
              />
              
              {/* 3. 축 설정 */}
              <XAxis type="number" dataKey="x_value" domain={[0, 1.2]} hide={true} />
              <YAxis 
                type="number" 
                dataKey="y_value" 
                domain={[-1.2, 1.2]} 
                axisLine={{ stroke: '#cbd5e1' }} 
                tickLine={false} 
                tick={false} 
              />
              <ZAxis range={[100, 100]} />
              
              {/* 4. 가이드라인 및 툴팁 */}
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
              
              {/* 5. 데이터 산점도 (자동차 아이콘) */}
              <Scatter
                data={scatterData}
                shape={(props: any) => {
                  const { cx, cy, payload } = props;
                  let baseSize = payload.isMyPatent ? 36 : payload.isHighSimilar ? 22 : 14;
                  let iconPath = payload.isMyPatent ? "/images/car-blue.svg" : payload.isHighSimilar ? "/images/car-red.svg" : "/images/car-yellow.svg";

                  return (
                    <image
                      x={cx - baseSize}
                      y={cy - baseSize}
                      width={baseSize * 2}
                      height={baseSize * 2}
                      href={iconPath}
                      className="cursor-pointer"
                      style={{ filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" }}
                    />
                  );
                }}
                onClick={(e: any) => e?.application_number && handleClick(e.application_number)}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>

          <div className="flex justify-center pt-2">
            <div className="flex gap-8 py-4 px-10 bg-slate-50/80 rounded-2xl border border-slate-100 shadow-sm">
              <LegendItem img="/images/car-blue.svg" label="나의 특허" color="text-blue-600" />
              <LegendItem img="/images/car-red.svg" label="고유사 특허" color="text-red-600" />
              <LegendItem img="/images/car-yellow.svg" label="기타 특허" color="text-amber-500" />
            </div>
          </div>

          <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100 flex gap-4 items-start">
            <div className="bg-rose-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-100">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-rose-900 uppercase">분석 결과 요약</h4>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                총 <strong className="text-rose-600">{totalCount}건</strong>의 유사 특허가 검색되었습니다. 
                그 중 <strong className="text-rose-600 font-black">{highSimilarityCount}건</strong>의 특허가 유사도가 높게 나타납니다.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ... 하단 헬퍼 컴포넌트(SectionTitle, LegendItem)는 기존과 동일
function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 px-1">
      <div className="w-1 h-3 bg-indigo-600 rounded-full" /> {title}
    </h3>
  );
}

function LegendItem({ img, label, color }: { img: string, label: string, color: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src={img} alt={label} className="w-6 h-6 drop-shadow-sm" />
      <span className={`text-[11px] font-black uppercase tracking-tight ${color}`}>{label}</span>
    </div>
  );
}