"use client";
import { useEffect, useState } from "react";
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
  BarChartBig, 
  Target, 
  TrendingUp, 
  Wallet,
  Activity,
  Info
} from "lucide-react";

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
      <div className="bg-white px-4 py-3 rounded-xl shadow-xl border border-slate-100">
        <p className="text-xs font-black text-slate-400 uppercase mb-1">
          {payload[0].payload.subject}
        </p>
        <p className="text-sm font-bold text-slate-900">
          점수: <span className="text-indigo-600">{payload[0].value}점</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function PatentEvaluationResult({ appNumber }: PatentEvaluationResultProps) {
  const [data, setData] = useState<EvaluationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appNumber) return;
    setLoading(true);
    setError(null);

    getPatentPrice(appNumber)
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [appNumber]);

  if (loading) return <div className="w-full h-64 bg-slate-50 animate-pulse rounded-[1.5rem]" />;

  if (error || !data) {
    return (
      <div className="w-full p-10 text-center bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
        <p className="text-slate-400 font-bold">평가 데이터가 존재하지 않습니다.</p>
      </div>
    );
  }

  const rows = [
    { name: "기술", value: data.tech, color: "#6366f1" },
    { name: "법률", value: data.legal, color: "#8b5cf6" },
    { name: "시장", value: data.market, color: "#06b6d4" },
    { name: "경제", value: data.economy, color: "#10b981" },
    { name: "전략", value: data.strategy, color: "#f59e0b" },
  ];

  const chartData = rows.map((r) => ({ subject: r.name, score: r.value }));
  const formatPrice = (n?: number | string) => n ? new Intl.NumberFormat().format(Number(n)) : "-";
  const avgScore = (rows.reduce((sum, r) => sum + r.value, 0) / rows.length).toFixed(1);

  return (
    <div className="w-full text-left font-sans">
      {/* 🏷️ 상단 제목 영역 */}
      <div className="mb-8 flex items-start gap-4">
        <BarChartBig className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            특허 가치 평가
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            5개 영역 종합 분석 및 가격 예측
          </p>
        </div>
      </div>

      {/* 🗺️ 메인 카드 컨테이너 */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        
        {/* [1] 진한 네이비 헤더 */}
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">
                평가 결과
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                Patent Valuation Result
              </p>
            </div>
          </div>
        </div>

        {/* [2] 주요 지표 타일 */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile 
            label="평균 점수" 
            value={`${avgScore}점`} 
            sub="5개 영역 평균" 
            icon={<Target size={16} className="text-indigo-500" />} 
          />
          <StatTile 
            label="예측 가격" 
            value={`₩${formatPrice(data.predicted_price)}`} 
            sub="예측 결과" 
            icon={<TrendingUp size={16} className="text-emerald-500" />} 
            color="emerald"
          />
          <StatTile 
            label="실제 가격" 
            value={data.real_price != null && !isNaN(Number(data.real_price)) ? `₩${formatPrice(data.real_price)}` : "정보없음"} 
            sub="거래 실거래가" 
            icon={<Wallet size={16} className="text-blue-500" />} 
          />
        </div>

        {/* [3] 세부 분석 섹션 */}
        <div className="p-8">
          <div className="grid md:grid-cols-2 gap-10 items-stretch">
            
            {/* 왼쪽: 세부 평가 항목 */}
            <div className="space-y-6">
              <SectionTitle title="세부 평가 항목" />
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.name} className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 hover:border-indigo-100 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color }} />
                        <span className="text-xs font-bold text-slate-600">{r.name}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">{r.value}점</span>
                    </div>
                    <div className="w-full bg-slate-200/50 rounded-full h-1.5">
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${r.value}%`, backgroundColor: r.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 오른쪽: Radar Chart */}
            <div className="space-y-6 flex flex-col">
              <SectionTitle title="종합 평가 차트" />
              <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 flex-1 flex items-center justify-center p-4">
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Radar
                      name="평가점수"
                      dataKey="score"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.4}
                      strokeWidth={3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

function StatTile({ label, value, sub, icon, color = "slate" }: any) {
  return (
    <div className="bg-white px-8 py-6 border-r last:border-r-0 border-slate-100 flex flex-col gap-2 group hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">{icon}</div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-black truncate ${color === 'emerald' ? 'text-emerald-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 px-1">
      <div className="w-1 h-3 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}