"use client";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { patentByCitpredict } from "@/lib/api";
import {
  TrendingUp,
  Calendar,
  BarChart3,
  Zap,
  CheckCircle2,
  Lightbulb
} from "lucide-react";
import EmptyDataNotice from "./EmptyDataNotice";

type CitationPredictionChartProps = {
  applicationNumber: string;
};

// 툴팁 디자인
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-4 py-3 rounded-xl shadow-xl border border-slate-100">
        <p className="text-xs font-black text-slate-400 uppercase mb-1">{data.label}</p>
        <div className="flex items-center gap-2 text-sm">
          <div className={`w-2.5 h-2.5 rounded-full ${data.isActual ? 'bg-indigo-300' : 'bg-indigo-600'}`} />
          <span className="text-slate-600 font-medium">누적 피인용수:</span>
          <span className="font-black text-slate-900">{data.citation}회</span>
        </div>
        {data.isActual && (
          <div className="mt-1 text-[10px] text-indigo-400 font-bold flex items-center gap-1">
            <CheckCircle2 size={10} /> 실제 데이터
          </div>
        )}
        {data.isPredicted && (
          <div className="mt-1 text-[10px] text-indigo-600 font-bold flex items-center gap-1">
            <Zap size={10} /> 예측 데이터
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function CitationPredictionChart({ applicationNumber }: CitationPredictionChartProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [citationInfo, setCitationInfo] = useState<any | null>(null);

  useEffect(() => {
    if (!applicationNumber) return;
    setIsLoading(true);
    
    patentByCitpredict(applicationNumber)
      .then((data: any) => {
        if (data.error) {
          setCitationInfo(null);
          return;
        }
        setCitationInfo(data);
        prepareChartData(data);
      })
      .catch(() => setCitationInfo(null))
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

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

  if (isLoading) return <div className="w-full h-96 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;

  if (!isLoading && !citationInfo) {
    return (
      <EmptyDataNotice
        icon={TrendingUp}
        title="피인용수 예측 데이터가 없습니다"
        description={"분석 데이터셋에 아직 포함되지 않은 특허일 수 있어요.\n주로 오래되었거나 등록 정보가 충분하지 않은 특허에서 나타납니다."}
      />
    );
  }

  const currentYear = citationInfo?.["연차수"] ?? 0;
  const currentCitation = citationInfo?.["현재_누적_피인용수"] ?? 0;
  const predictedCitation = citationInfo?.["10년차_누적_피인용수"] ?? 0;
  
  // 🎯 [수정] 요청하신 X축 범위 로직 적용
  let xMin, xMax;
  if (currentYear <= 10) {
    xMin = Math.max(1, currentYear - 1); // 최소 1년차부터 시작
    xMax = 11;
  } else {
    xMin = 9;
    xMax = currentYear + 1;
  }

  const xAxisDomain = [xMin, xMax];
  
  // 도메인 범위에 따른 틱(Ticks) 생성
  const ticks = [];
  for (let i = xMin; i <= xMax; i++) {
    ticks.push(i);
  }

  const growthRate = currentYear <= 10 && currentCitation > 0
    ? (((predictedCitation - currentCitation) / currentCitation) * 100).toFixed(1)
    : null;

  return (
    <div className="w-full text-left font-sans">
      <div className="mb-8 flex items-start gap-4">
        <TrendingUp className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            피인용수 예측 분석
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            특허 인용 추세 및 10년차 예측 리포트
          </p>
        </div>
      </div>

      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">
                인용 추세 분석
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                Citation Trend Analysis & Prediction
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile label="현재 연차" value={`${currentYear}년`} sub="출원 후 경과 기간" icon={<Calendar size={16} className="text-indigo-500" />} />
          <StatTile label="현재 누적" value={`${currentCitation.toLocaleString()}회`} sub="누적 피인용수" icon={<BarChart3 size={16} className="text-blue-500" />} />
          <StatTile label="10년차 예측" value={`${predictedCitation.toLocaleString()}회`} sub={currentYear <= 10 ? "증가 예상 결과" : "역산 추정값"} icon={<Zap size={16} className="text-indigo-500" />} color="indigo" />
        </div>

        <div className="p-8 space-y-8">
          <div className="flex items-center justify-between">
            <SectionTitle title={currentYear <= 10 ? "피인용수 추이 및 예측" : "피인용수 역산 추정"} />
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-300" /> 실제</div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> 예측</div>
            </div>
          </div>

          <div className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-6">
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                {/* 🎯 [수정] 최적화된 도메인 및 틱 적용 */}
                <XAxis 
                  dataKey="year" 
                  type="number" 
                  domain={xAxisDomain}
                  ticks={ticks}
                  tickFormatter={(val) => `${val}년`}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                  axisLine={{ stroke: '#e2e8f0' }}
                />
                <YAxis 
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} 
                  axisLine={false} 
                  tickLine={false} 
                  tickFormatter={(val) => `${val}회`}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={10} stroke="#cbd5e1" strokeDasharray="5 5" label={{ position: 'top', value: '10년차', fill: '#94a3b8', fontSize: 10, fontWeight: 800 }} />
                <Line
                  type="monotone"
                  dataKey="citation"
                  stroke="#6366f1"
                  strokeWidth={4}
                  dot={(props: any) => {
                    const { cx, cy, payload, index } = props;
                    if (payload.isActual) {
                      return <circle cx={cx} cy={cy} r={6} fill="#a5b4fc" stroke="#fff" strokeWidth={2} />;
                    }
                    const isLastPoint = index === chartData.length - 1;
                    if (isLastPoint) {
                      return <circle cx={cx} cy={cy} r={7} fill="#6366f1" stroke="#fff" strokeWidth={2} />;
                    }
                    return <circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#6366f1" strokeWidth={2} />;
                  }}
                  activeDot={{ r: 9, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-indigo-50/50 rounded-2xl p-6 border border-indigo-100/50 flex gap-4 items-start">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-lg shadow-indigo-100">
              <Lightbulb size={20} />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-indigo-900 uppercase tracking-tight">예측 인사이트</h4>
              <p className="text-sm text-slate-600 leading-relaxed font-medium">
                현재 {currentYear}년차에 {currentCitation}회의 피인용수를 기록 중이며, 
                10년차 시점에는 약 <strong className="text-indigo-600">{predictedCitation}회</strong>에 도달할 것으로 분석됩니다.
                {growthRate && <> 이는 현재 대비 <strong className="text-indigo-600">{growthRate}%</strong> 수준의 성장이 전망되는 수치입니다.</>}
              </p>
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
      <div className={`text-xl font-black truncate ${color === 'indigo' ? 'text-indigo-600' : 'text-slate-900'}`}>
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