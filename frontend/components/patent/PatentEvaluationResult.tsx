"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import { getPatentPrice } from "@/lib/api";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  TrendingUp,
  ShieldCheck,
  BarChart3,
  CircleDollarSign,
  Compass,
  Award,
  Cpu,
  Info,
  CheckCircle2,
  LayoutDashboard,
  ArrowRight
} from "lucide-react";

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

// 🎯 커스텀 툴팁: 다크 테마 일관성 유지
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/95 backdrop-blur-md px-5 py-4 rounded-[1.5rem] shadow-2xl border border-white/10">
        <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2">{payload[0].payload.subject}</p>
        <p className="text-xl font-black text-white">
          {payload[0].value}<span className="text-xs ml-1 text-slate-400">점</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function PatentEvaluationResult({ appNumber }: { appNumber: string }) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appNumber) return;
    setLoading(true);
    getPatentPrice(appNumber)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [appNumber]);

  if (loading) {
    return (
      <div className="w-full animate-pulse space-y-10">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[600px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="w-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
        <Info className="mx-auto text-slate-300 mb-4" size={48} />
        <p className="text-slate-500 font-bold">평가 데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  const rows = [
    { name: "기술", value: data.tech, color: "#6366f1", icon: <Cpu size={14} /> },
    { name: "법률", value: data.legal, color: "#8b5cf6", icon: <ShieldCheck size={14} /> },
    { name: "시장", value: data.market, color: "#06b6d4", icon: <BarChart3 size={14} /> },
    { name: "경제", value: data.economy, color: "#10b981", icon: <CircleDollarSign size={14} /> },
    { name: "전략", value: data.strategy, color: "#f59e0b", icon: <Compass size={14} /> },
  ];

  const chartData = rows.map((r) => ({ subject: r.name, score: r.value }));
  const formatPrice = (n?: number | string) => n ? new Intl.NumberFormat().format(Number(n)) : "-";
  const avgScore = (rows.reduce((sum, r) => sum + r.value, 0) / rows.length).toFixed(1);

  return (
    <div className="w-full text-left font-sans pb-10 mt-20">
      {/* 🏷️ Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">특허 가치 평가</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          Comprehensive 5-Dimensional Valuation Report
        </p>
      </div>

      {/* 🗺️ Main Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

        {/* [1] 타이틀 섹션 */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between border-b border-slate-800">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <LayoutDashboard size={20} className="text-indigo-400" /> Valuation Summary
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">AI-Powered Asset Appraisal</p>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest">
            APP NUM: {appNumber}
          </div>
        </div>

        {/* [2] 🎯 핵심 가치 지표 (타이틀 바로 아래 Tile 배치) */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile label="종합 평균 점수" value={`${avgScore}점`} sub="Performance Rating" icon={<Award className="text-indigo-500" />} />
          <StatTile label="AI 예측 가치" value={`₩${formatPrice(data.predicted_price)}`} sub="Estimated Value" icon={<TrendingUp className="text-emerald-500" />} color="emerald" isHighlight />
          <StatTile label="최근 실거래가" value={data.real_price != null && !isNaN(Number(data.real_price)) ? `₩${formatPrice(data.real_price)}` : "정보없음"} sub="Market Benchmark" icon={<CircleDollarSign className="text-amber-500" />} />
        </div>

        {/* [3] 📊 세부 분석 영역 */}
        <div className="p-10">
          <div className="grid lg:grid-cols-12 gap-12 items-start">

            {/* Left: Detail Scores (7) */}
            <div className="lg:col-span-7 space-y-8">
              <SectionTitle title="영역별 평가 지표" />
              <div className="grid gap-4 mt-6">
                {rows.map((r) => (
                  <div key={r.name} className="group bg-slate-50 rounded-[1.5rem] p-5 border border-transparent hover:border-indigo-100 hover:bg-white hover:shadow-xl hover:shadow-indigo-50/30 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-indigo-500 transition-colors">
                          {r.icon}
                        </div>
                        <span className="text-sm font-black text-slate-700">{r.name} 역량 분석</span>
                      </div>
                      <span className="text-xl font-black text-slate-900">{r.value}<span className="text-xs text-slate-400 ml-1 font-bold">PTS</span></span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${r.value}%`, backgroundColor: r.color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Radar Chart (5) */}
            <div className="lg:col-span-5 space-y-8">
              <SectionTitle title="종합 밸런스 시각화" />
              <div className="mt-6 bg-gradient-to-br from-slate-50 to-white rounded-[2.5rem] p-8 border border-slate-100 relative shadow-inner-sm">
                <ResponsiveContainer width="100%" height={340}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 900 }}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Radar
                      name="Valuation"
                      dataKey="score"
                      stroke="#4f46e5"
                      strokeWidth={3}
                      fill="#6366f1"
                      fillOpacity={0.12}
                    />
                  </RadarChart>
                </ResponsiveContainer>
                <div className="absolute bottom-6 right-8 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] italic">
                  AI Matrix Simulation
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* 🏁 Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {/* <CheckCircle2 size={12} className="text-emerald-500" />  */}
            💡 평가 점수는 기술, 법률, 시장, 경제, 전략 5개 영역을 종합 분석한 결과입니다.
          </p>
          <div className="h-1 w-20 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 w-full animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- [Reusable Components] ---

function StatTile({ label, value, sub, icon, isHighlight = false, color = "indigo" }: any) {
  return (
    <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'emerald' ? 'text-emerald-600' : 'text-slate-900'}`}>
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