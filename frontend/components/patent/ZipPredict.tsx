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
  TrendingUp,
  BarChart3,
  Zap,
  CheckCircle2,
  Clock,
  LayoutDashboard,
  ArrowRight,
  Info
} from "lucide-react";

// 🎯 커스텀 툴팁: 프로젝트 다크 테마 적용
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-900 px-5 py-4 rounded-[1.5rem] shadow-2xl border border-white/10 ring-1 ring-black/5">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">{data.label}</p>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl font-black text-white">{data.citation}</span>
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">회 인용</span>
        </div>
        <div>
          {data.isActual ? (
            <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20 uppercase">Actual</span>
          ) : (
            <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 uppercase">Predicted</span>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// 🎯 옛날 코드의 화살표 로직 그대로 유지
const LineWithArrow = ({ points, currentYear, chartData }: any) => {
  if (!points || points.length === 0) return null;
  const currentIdx = chartData.findIndex((d: any) => d.isActual);
  if (currentIdx === -1) return null;

  const isForward = currentYear <= 10;
  const currentPoint = points[currentIdx];
  const nextIdx = isForward ? currentIdx + 1 : currentIdx - 1;

  if (!currentPoint || nextIdx < 0 || nextIdx >= points.length) return null;
  const nextPoint = points[nextIdx];

  const midX = (currentPoint.x + nextPoint.x) / 2;
  const midY = (currentPoint.y + nextPoint.y) / 2;
  const angle = Math.atan2(nextPoint.y - currentPoint.y, nextPoint.x - currentPoint.x);
  const arrowSize = 10;

  return (
    <g>
      <polygon
        points={`0,${-arrowSize / 2} ${arrowSize},0 0,${arrowSize / 2}`}
        fill="#06b6d4"
        transform={`translate(${midX},${midY}) rotate(${angle * 180 / Math.PI})`}
      />
    </g>
  );
};

export default function CitationPredictionChart({ applicationNumber }: { applicationNumber: string }) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [citationInfo, setCitationInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!applicationNumber) return;
    setIsLoading(true);
    patentByCitpredict(applicationNumber)
      .then((data: any) => {
        if (!data.error) {
          setCitationInfo(data);
          prepareChartData(data);
        }
      })
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  // 🛠️ 옛날 데이터 준비 로직 그대로 유지
  const prepareChartData = (data: any) => {
    const yearlyPredictions = data["연도별_예측"] || [];
    const chartPoints = yearlyPredictions.map((item: any) => ({
      year: item.year,
      citation: item.cumulative_citation,
      label: item.is_actual ? `${item.year}년차 (현재)` : `${item.year}년차 (예측)`,
      isActual: item.is_actual || false,
      isPredicted: !item.is_actual
    }));
    setChartData(chartPoints);
  };

  if (isLoading) {
    return (
      <div className="w-full animate-pulse space-y-10">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[650px]" />
      </div>
    );
  }

  if (!citationInfo) return null;

  const currentYear = citationInfo?.["연차수"] ?? 0;
  const currentCitation = citationInfo?.["현재_누적_피인용수"] ?? 0;
  const predictedCitation = citationInfo?.["10년차_누적_피인용수"] ?? 0;
  const growthRate = currentCitation > 0 ? (((predictedCitation - currentCitation) / currentCitation) * 100).toFixed(1) : "0";
  const xAxisDomain = [1, currentYear <= 10 ? 10 : currentYear];

  return (
    <div className="w-full text-left font-sans pb-20 mt-10">
      {/* 🏷️ Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">피인용수 예측 분석</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">특허 인용 추세 및 10년차 예측</p>
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

        {/* [1] 타이틀 섹션 */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <LayoutDashboard size={20} className="text-indigo-400" /> Citation Trend Analysis
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Future Impact Simulation</p>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest font-mono">
            APP NUM: {applicationNumber}
          </div>
        </div>

        {/* [2] 상단 핵심 지표 타일 (새로운 레이아웃) */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile label="현재 연차" value={`${currentYear}년차`} sub="Years Active" icon={<Clock className="text-indigo-500" />} />
          <StatTile label="현재 누적 인용" value={`${currentCitation.toLocaleString()}회`} sub="Current Cumulative" icon={<BarChart3 className="text-emerald-500" />} />
          <StatTile label="10년차 예측" value={`${predictedCitation.toLocaleString()}회`} sub={currentYear <= 10 ? `+${growthRate}% 예상` : "역산 추정"} icon={<Zap className="text-amber-500" />} isHighlight color="amber" />
        </div>

        <div className="p-10">
          <div className="grid lg:grid-cols-12 gap-12 items-start">

            {/* Left: 📊 옛날 그래프 구조 그대로 복원 (8) */}
            <div className="lg:col-span-8 space-y-8">
              <SectionTitle title={currentYear <= 10 ? "피인용수 추이 및 예측" : "피인용수 역산 추정"} />
              <div className="mt-6 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-inner-sm">
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 40, right: 30, left: 10, bottom: 20 }}
                  >
                    <defs>
                      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                        <polygon points="0 0, 10 5, 0 10" fill="#06b6d4" />
                      </marker>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} />
                    <XAxis
                      dataKey="year" type="number" domain={xAxisDomain}
                      ticks={Array.from({ length: xAxisDomain[1] - xAxisDomain[0] + 1 }, (_, i) => xAxisDomain[0] + i)}
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      label={{ value: "연차 (년)", position: "insideBottom", offset: -10, style: { fill: '#3f3f46', fontWeight: 600, fontSize: 12 } }}
                    />
                    <YAxis
                      tick={{ fill: '#52525b', fontSize: 12 }}
                      label={{ value: "누적 피인용수", angle: -90, position: "insideLeft", offset: 10, dy: 50, style: { fill: '#3f3f46', fontWeight: 600, fontSize: 12 } }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ paddingTop: '25px', paddingLeft: '50px' }} />
                    <Line
                      type="monotone" dataKey="citation" stroke="#06b6d4" strokeWidth={3}
                      name={currentYear <= 10 ? "예측 추세" : "역산 추정"}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        if (payload.isActual) return <circle cx={cx} cy={cy} r={8} fill="#10b981" stroke="#fff" strokeWidth={2} />;
                        return <circle cx={cx} cy={cy} r={6} fill="#2563eb" stroke="#fff" strokeWidth={2} />;
                      }}
                    >
                      <LineWithArrow currentYear={currentYear} chartData={chartData} />
                    </Line>
                    <ReferenceLine x={10} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: "10년차", position: "top", fill: "#64748b", fontSize: 12, fontWeight: 600 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: AI Insights (4) */}
            <div className="lg:col-span-4 space-y-8">
              <SectionTitle title="AI 분석 리포트" />
              <div className="mt-6 bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                <TrendingUp className="absolute -right-4 -top-4 text-indigo-500 opacity-20 group-hover:scale-110 transition-transform" size={120} />
                <div className="relative z-10 space-y-6">
                  <div className="bg-white/10 w-10 h-10 rounded-xl flex items-center justify-center"><Zap size={20} className="text-indigo-200" /></div>
                  <div>
                    <h4 className="text-lg font-black tracking-tight mb-2 uppercase">Forecast Insight</h4>
                    <p className="text-indigo-100 text-sm leading-relaxed font-medium">
                      본 특허는 현재 <span className="text-white font-black underline underline-offset-4">{currentYear}년차</span> 기준 {currentCitation}회의 인용을 기록 중이며,
                      향후 10년차 시점에 누적 약 <span className="text-white font-black">{Math.round(predictedCitation)}회</span> 도달이 예상됩니다.
                    </p>
                  </div>
                  <div className="pt-6 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Growth Potential</span>
                    <span className="text-2xl font-black">+{growthRate}%</span>
                  </div>
                </div>
              </div>

              {/* Legend Card */}
              <div className="bg-white rounded-[2rem] p-6 border border-slate-100 space-y-4">
                <LegendRow color="bg-emerald-500" label="실제 데이터 (Current)" />
                <LegendRow color="bg-blue-600" label="예측/추정 데이터 (Future)" />
                <div className="pt-4 border-t border-slate-50 flex items-start gap-2">
                  <p className="text-[11px] font-bold text-slate-400 italic leading-relaxed">
                    💡 {currentYear <= 10 ? "예측 모델은 과거 인용 추세를 기반으로 미래를 추정합니다." : "10년 이상 특허는 역산 모델을 통해 시뮬레이션합니다."}
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 🏁 Footer */}
        <div className="px-12 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <p className="flex items-center gap-2">
            {/* <CheckCircle2 size={12} className="text-emerald-500" /> AI Prediction Matrix Complete */}
            💡 예측 모델은 과거 인용 추세를 기반으로 미래 피인용수를 추정합니다.
          </p>
          <span>APP_NO: {applicationNumber}</span>
        </div>
      </div>
    </div>
  );
}

// --- [Reusable Sub Components] ---

function StatTile({ label, value, sub, icon, isHighlight = false, color = "indigo" }: any) {
  return (
    <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'amber' ? 'text-amber-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
        <ArrowRight size={12} className="text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
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

function LegendRow({ color, label }: any) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full ${color}`} />
      <span className="text-xs font-black text-slate-700 tracking-tight">{label}</span>
    </div>
  );
}