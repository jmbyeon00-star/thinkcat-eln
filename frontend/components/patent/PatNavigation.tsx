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
  ZAxis,
  ReferenceLine,
} from "recharts";
import {
  Compass,
  ShieldAlert,
  Search,
  History,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Target
} from "lucide-react";
import { patentByNavigate } from "@/lib/api";

// --- [타입 정의 및 커스텀 툴팁 로직은 이전과 동일하게 유지] ---
type NavigationData = {
  application_number: string;
  filing_date?: string;
  x_value: number;
  y_value: number;
  score: number;
  date_type: number;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const formatDate = (dateString?: string) => dateString?.split('T')[0] || "-";
    return (
      <div className="bg-slate-900/95 backdrop-blur-md px-5 py-4 rounded-[1.5rem] shadow-2xl border border-white/10 ring-1 ring-black/5">
        <p className="text-[14px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-3">특허정보</p>
        <div className="space-y-2.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] text-slate-500 font-bold uppercase">출원번호</span>
            <span className="text-sm font-black text-white">{data.application_number}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[12px] text-slate-500 font-bold uppercase">출원일자</span>
            <span className="text-sm font-black text-white">{formatDate(data.filing_date)}</span>
          </div>
          <div className="pt-2.5 flex items-center gap-2 border-t border-white/10">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="text-[11px] font-black uppercase tracking-tight text-slate-300">
              {(data.date_type === 0 && data.x_value === 0.0) ? "나의 특허" :
                (data.x_value >= -0.15 && data.x_value <= 0.275) ? "침해 위험군" : "기타 비교군"}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function PatNavigationChart({ applicationNumber, code }: { applicationNumber: string; code: string }) {
  const router = useRouter();
  const [plotData, setPlotData] = useState<NavigationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!applicationNumber || !code) return;
    setIsLoading(true);
    patentByNavigate(applicationNumber, code)
      .then((data) => setPlotData(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [applicationNumber, code]);

  if (isLoading) {
    return (
      <div className="w-full animate-pulse space-y-10">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[700px]" />
      </div>
    );
  }

  // 🛠️ 기존 가공 로직 및 구조 완벽 보존
  const scatterData = plotData.map((item) => {
    const isMyPatent = item.date_type === 0 && item.x_value === 0.0;
    const isRisk = (item.x_value / 2 >= 0 && item.x_value / 2 <= 0.425) && !isMyPatent;
    return {
      ...item,
      x_value: isRisk ? item.x_value / 2 - 0.15 : item.x_value / 2,
      color: isMyPatent ? "#4f46e5" : isRisk ? "#ef4444" : "#facc15",
      size: isMyPatent ? 200 : isRisk ? 90 : 50,
      iconPath: isMyPatent ? '/images/car-blue.svg' : isRisk ? '/images/car-red.svg' : '/images/car-yellow.svg'
    };
  });

  const myCount = 1;
  const totalCount = scatterData.length;
  const riskCount = scatterData.filter(d => d.color === "#ef4444").length;
  const otherCount = Math.max(0, scatterData.length - riskCount - 1);

  return (
    <div className="w-full text-left font-sans pb-20 mt-20">
      {/* 🏷️ Page Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">특허 네비게이션 분석</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Spatial Intelligence & Strategic Mapping</p>
      </div>

      {/* 🗺️ Main Card Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

        {/* [1] 타이틀 섹션 */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <LayoutDashboard size={20} className="text-indigo-400" /> Patent Positioning Map
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Visualizing Patent Distribution</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Target size={14} className="text-indigo-400" />
            <span className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">{code}</span>
          </div>
        </div>

        {/* [2] 🎯 핵심 통계 지표 (타이틀 바로 아래로 이동!) */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile label="나의 특허" value={`${myCount}건`} sub="Origin" icon={<Compass className="text-indigo-500" />} />
          <StatTile label="침해 위험" value={`${riskCount}건`} sub="High Risk" icon={<ShieldAlert className="text-rose-500" />} color="rose" />
          <StatTile label="기타 비교" value={`${otherCount}건`} sub="Comparisons" icon={<Search className="text-amber-500" />} />
        </div>

        {/* [3] 📊 분포 시각화 그래프 (구조 유지) */}
        <div className="p-10 bg-white relative group">
          <div className="mb-6 flex items-center justify-between">
            <SectionTitle title="특허 분포 시뮬레이션" />
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
              <History size={12} /> Time Sequence (↑)
            </div>
          </div>

          <div className="bg-slate-50/30 rounded-[2rem] p-6 border border-slate-50 relative overflow-hidden">
            <ResponsiveContainer width="100%" height={500}>
              <ScatterChart margin={{ top: 30, right: 80, bottom: 40, left: 40 }}>
                <defs>
                  <pattern id="bg-pattern" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                    <image href="/images/semicircle-bg.svg" x="100" y="0" width="calc(100% - 50px)" height="100%" opacity="0.2" preserveAspectRatio="none" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern)" />
                <CartesianGrid stroke="none" />
                <ReferenceLine y={0} stroke="#d4d4d8" strokeWidth={2} label={{ value: "SIMILARITY →", position: "right", fill: '#94a3b8', fontWeight: 900, fontSize: 11 }} />
                <XAxis type="number" dataKey="x_value" domain={[0, 1]} hide />
                <YAxis type="number" dataKey="y_value" domain={[-1, 1]} ticks={[]} axisLine={{ stroke: '#d4d4d8' }} tickLine={false} />
                <ZAxis dataKey="size" range={[30, 300]} />
                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                <Scatter
                  data={scatterData}
                  shape={(props: any) => {
                    const payload = props.payload;
                    let baseSize = Math.sqrt(props.z || 60) / 0.55;

                    // 크기 계산 로직 유지
                    if (payload.date_type === 0 && payload.x_value === 0.0) baseSize *= 1.8;
                    else if (payload.x_value >= -0.15 && payload.x_value <= 0.275) baseSize *= 1.3;

                    return (
                      <image
                        x={props.cx - baseSize}
                        y={props.cy - baseSize}
                        width={baseSize * 2}
                        height={baseSize * 2}
                        href={payload.iconPath}
                        /* 🎯 hover 효과 수정: transition-all 대신 transform만 적용하고 duration 조절 */
                        className="cursor-pointer transition-transform duration-200 ease-out hover:scale-125"
                        style={{
                          filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.12))',
                          /* 🔥 핵심: 중심점을 아이콘 중앙으로 고정하여 떨림 방지 */
                          transformOrigin: 'center',
                          transformBox: 'fill-box'
                        }}
                      />
                    );
                  }}
                  onClick={(e: any) => e?.application_number && router.push(`/search/applicationNum/${e.application_number}`)}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* 범례 Area */}
          <div className="mt-8 flex flex-wrap justify-center gap-10">
            <LegendItem icon="/images/car-blue.svg" label="나의 기준 특허" />
            <LegendItem icon="/images/car-red.svg" label="침해 위험 특허" />
            <LegendItem icon="/images/car-yellow.svg" label="기타 분석 특허" />
          </div>
        </div>


        {/* [4] 🚨 최종 위험 알림 섹션 */}
        {/* <div className="px-10 pb-10">
          <div className="bg-rose-600 rounded-[2rem] p-8 text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
            <div className="relative z-10 flex items-start gap-6">
              <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:rotate-12 transition-transform">
                <AlertCircle size={28} className="text-white" />
              </div>
              <div>
                <h4 className="text-xl font-black tracking-tight mb-2 uppercase italic">
                  침해 위험 알림
                </h4>
                <p className="text-rose-100 text-[15px] leading-relaxed font-medium">
                  총 <strong className="text-white-600">{totalCount.toLocaleString()}건</strong>의 특허 중&nbsp;
                  특허가 매우 유사한 포지션은 <span className="text-white font-black underline underline-offset-4">{riskCount}건</span>입니다.
                  맵 상의 <span className="text-white font-black">빨간색 자동차</span> 아이콘을 클릭하여
                  위험 요소를 즉시 검토하십시오.
                </p>
              </div>
            </div>
            <ShieldAlert size={160} className="absolute -right-12 -bottom-12 text-white/5" />
          </div>
        </div> */}
        <div className="px-10 pb-10">
          {riskCount > 0 ? (
            /* 🔥 [위험 상태] - 침해 위험 특허가 1개라도 있을 때 (Rose 테마) */
            <div className="bg-rose-600 rounded-[2rem] p-8 text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
              <div className="relative z-10 flex items-start gap-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:rotate-12 transition-transform">
                  <AlertCircle size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tight mb-2 uppercase italic">
                    {/* Infringement Risk Detected */}
                    침해 위험 알림
                  </h4>
                  <p className="text-rose-100 text-[15px] leading-relaxed font-medium">
                    분석 결과, 총 <strong className="text-white-600">{totalCount.toLocaleString()}건</strong>의 특허 중&nbsp;
                    <span className="text-white font-black underline underline-offset-4">{riskCount}건</span>의
                    특허가 위험 범위에 포착되었습니다. 맵 상의 <span className="text-white font-black">빨간색 자동차</span>를 클릭하여
                    유사 요소를 즉시 검토하십시오.
                  </p>
                </div>
              </div>
              <ShieldAlert size={160} className="absolute -right-12 -bottom-12 text-white/10" />
            </div>
          ) : (
            /* ✅ [안전 상태] - 침해 위험 특허가 0개일 때 (Emerald 테마) */
            <div className="bg-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
              <div className="relative z-10 flex items-start gap-6">
                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                  <CheckCircle2 size={28} className="text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-black tracking-tight mb-2 uppercase italic">
                    {/* Safe Strategic Position */}
                    침해 안전 알림
                  </h4>
                  <p className="text-emerald-100 text-[15px] leading-relaxed font-medium">
                    축하합니다! 현재 분석 범위 내에서 귀하의 특허와 충돌하는 특허는 <span className="text-white font-black underline underline-offset-4">{riskCount}건</span>으로&nbsp;
                    <span className="text-white font-black underline underline-offset-4">고위험 특허가 발견되지 않았습니다.</span>&nbsp;
                    기타 비교 특허들과의 거리를 유지하며 독자적인 기술 우위를 확보하십시오.
                  </p>
                </div>
              </div>
              <CheckCircle2 size={160} className="absolute -right-12 -bottom-12 text-white/10" />
            </div>
          )}
        </div>

        {/* 🏁 Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {/* <CheckCircle2 size={12} className="text-emerald-500" /> AI Positioning Verified */}
            💡 자동차 아이콘을 클릭하면 해당 특허의 상세 정보를 확인할 수 있습니다. 아이콘의 크기는 중요도를 나타냅니다.
          </p>
          <span className="text-[10px] font-black text-slate-300 italic">Snapshot: {applicationNumber}</span>
        </div>
      </div>
    </div>
  );
}

// --- [재사용 컴포넌트] ---

function StatTile({ label, value, sub, icon, color = "indigo" }: any) {
  return (
    <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'rose' ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}

function LegendItem({ icon, label }: any) {
  return (
    <div className="flex items-center gap-3 group cursor-default">
      <img src={icon} alt={label} className="w-6 h-6 object-contain group-hover:scale-125 transition-transform" />
      <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{label}</span>
    </div>
  );
}