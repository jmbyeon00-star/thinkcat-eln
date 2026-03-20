"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { patentByNavigate } from "@/lib/api";
import { Compass, AlertCircle, CheckCircle2 } from "lucide-react";

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
    if (applicationNum) router.push(`/search/applicationNum/${applicationNum}`);
  };

  useEffect(() => {
    if (!applicationNumber || !code) return;
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const data = await patentByNavigate(applicationNumber, code);
        if (Array.isArray(data)) setPlotData(data);
      } catch (err) {
        console.error("데이터 로드 실패:", err);
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

  const scatterData = plotData.map((item) => {
    const isMyPatent = item.date_type === 0 && item.x_value === 0.0;
    const isHighSimilar = !isMyPatent && item.x_value <= 0.85;

    let displayX: number;
    if (isMyPatent) displayX = 0.0;
    else if (isHighSimilar) displayX = 0.2 + (item.x_value / 0.85) * 0.3;
    else displayX = 0.55 + ((item.x_value - 0.85) / 0.15) * 0.4;

    const color = isMyPatent ? "#2563eb" : isHighSimilar ? "#ef4444" : "#f59e0b";
    return { ...item, original_x: item.x_value, x_value: displayX, color, isMyPatent, isHighSimilar };
  });

  const totalCount = scatterData.length;
  const highSimilarityCount = scatterData.filter((d) => d.isHighSimilar).length;

  return (
    <div className="w-full text-left font-sans">
      <div className="mb-8 flex items-start gap-4">
        <Compass className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            특허 네비게이션 분석
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            유사 특허 분포 및 근접도 시각화 리포트
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <h2 className="text-2xl font-black text-white tracking-tighter">특허 포지셔닝 맵</h2>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
              Patent Navigation & Positioning Map
            </p>
        </div>


        <div className="p-8 space-y-6">
          <SectionTitle title="특허 분포 시각화" />

          {/* 그래프 카드 영역 */}
          <div className="bg-white rounded-[2rem] border border-slate-100 p-0 relative overflow-hidden h-[500px]">
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
                <defs>
                  <pattern 
                    id="semicircle-bg" 
                    x="-8.5%" 
                    y="0" 
                    width="1" 
                    height="1" 
                    patternContentUnits="objectBoundingBox"
                  >
                    <image 
                      href="/images/semicircle-bg.svg" 
                      x="0" 
                      y="0" 
                      width="1" 
                      height="1" 
                      preserveAspectRatio="xMinYMid meet" 
                      style={{ opacity: 0.2 }}
                    />
                  </pattern>
                </defs>
                
                <rect x="0" y="0" width="100%" height="100%" fill="url(#semicircle-bg)" />
                
                <XAxis type="number" dataKey="x_value" domain={[0, 1.2]} hide={true} />
                <YAxis type="number" dataKey="y_value" domain={[-1, 1]} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={false} />
                <ZAxis range={[100, 100]} />
                <Tooltip content={<CustomTooltip />} />
                
                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                
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

          {/* 🎯 [이동] 범례를 그래프 카드 밖으로 배치 */}
          <div className="flex justify-center pt-2">
            <div className="flex gap-8 py-4 px-10 bg-slate-50/80 rounded-2xl border border-slate-100 shadow-sm">
              <LegendItem img="/images/car-blue.svg" label="나의 특허" color="text-blue-600" />
              <LegendItem img="/images/car-red.svg" label="고유사 특허" color="text-red-600" />
              <LegendItem img="/images/car-yellow.svg" label="기타 특허" color="text-amber-500" />
            </div>
          </div>

          {/* 위험 알람 섹션 */}
          <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100 flex gap-4 items-start">
            <div className="bg-rose-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-100">
              <AlertCircle size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-rose-900 uppercase">유사 특허 알림</h4>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                분석된 <strong className="text-rose-600">{totalCount.toLocaleString()}건</strong>의 특허 중{" "}
                <strong className="text-rose-600 font-black underline decoration-rose-200 underline-offset-4">{highSimilarityCount}건</strong>이 
                위험 수준의 높은 유사도를 보입니다. 자동차 아이콘을 클릭하여 상세 정보를 확인하세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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