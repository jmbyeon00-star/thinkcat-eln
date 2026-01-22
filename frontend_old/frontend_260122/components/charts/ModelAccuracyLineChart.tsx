import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Legend,
} from "recharts";
import { Activity, TrendingUp } from "lucide-react";

// 데이터셋 정의
const lineData = [
  { epoch: 1, mBERT: 0.0111, KorPatBERT: 0.0139, IPforce: 0.0277 },
  { epoch: 2, mBERT: 0.0139, KorPatBERT: 0.0333, IPforce: 0.0750 },
  { epoch: 3, mBERT: 0.0556, KorPatBERT: 0.0139, IPforce: 0.1388 },
  { epoch: 4, mBERT: 0.1083, KorPatBERT: 0.0222, IPforce: 0.2444 },
  { epoch: 5, mBERT: 0.1611, KorPatBERT: 0.0472, IPforce: 0.3666 },
  { epoch: 6, mBERT: 0.1917, KorPatBERT: 0.0472, IPforce: 0.4444 },
  { epoch: 7, mBERT: 0.2250, KorPatBERT: 0.0639, IPforce: 0.4861 },
  { epoch: 8, mBERT: 0.2611, KorPatBERT: 0.1111, IPforce: 0.5194 },
  { epoch: 9, mBERT: 0.3361, KorPatBERT: 0.1833, IPforce: 0.5416 },
  { epoch: 10, mBERT: 0.3389, KorPatBERT: 0.2806, IPforce: 0.5722 },
  { epoch: 11, mBERT: 0.3778, KorPatBERT: 0.3972, IPforce: 0.6000 },
  { epoch: 12, mBERT: 0.3944, KorPatBERT: 0.4722, IPforce: 0.6111 },
  { epoch: 13, mBERT: 0.3861, KorPatBERT: 0.5028, IPforce: 0.6250 },
  { epoch: 14, mBERT: 0.4139, KorPatBERT: 0.5111, IPforce: 0.6444 },
  { epoch: 15, mBERT: 0.4333, KorPatBERT: 0.5167, IPforce: 0.6583 },
  { epoch: 16, mBERT: 0.4611, KorPatBERT: 0.5056, IPforce: 0.6666 },
  { epoch: 17, mBERT: 0.4750, KorPatBERT: 0.5500, IPforce: 0.6694 },
  { epoch: 18, mBERT: 0.4639, KorPatBERT: 0.5444, IPforce: 0.6944 },
  { epoch: 19, mBERT: 0.4944, KorPatBERT: 0.5444, IPforce: 0.6944 },
  { epoch: 20, mBERT: 0.5111, KorPatBERT: 0.5611, IPforce: 0.7000 }
];

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 px-3 py-2 rounded-xl shadow-2xl border border-white/10">
        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1 border-b border-white/5 pb-1">
          Epoch {label}
        </p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[10px] font-bold text-zinc-400">{entry.name}</span>
              </div>
              <span className="text-[10px] font-black text-white">{entry.value.toFixed(3)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// 마지막 수치 라벨
const LastLabel = ({ x, y, value, index }: any) => {
  const isLast = index === lineData.length - 1;
  if (!isLast) return null;
  return (
    <text x={x + 8} y={y - 8} fill="#2563eb" fontSize={11} fontWeight={900} textAnchor="start" className="font-black tracking-tighter">
      {value.toFixed(2)}
    </text>
  );
};

export default function ModelAccuracyLineChart() {
  return (
    <div className="w-full max-w-5xl mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 1. Header (BarChart와 크기 통일) */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 leading-none">
            학습 효율 분석<span className="text-blue-600">.</span>
          </h2>
          <div className="hidden md:flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
            <Activity size={10} className="text-blue-600" />
            <span className="text-[9px] font-black uppercase tracking-widest">Training Metrics</span>
          </div>
        </div>
        <p className="text-zinc-400 text-xs font-bold hidden sm:block uppercase tracking-tighter">Accuracy over Epochs</p>
      </div>

      {/* 2. Main Card */}
      <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-200/40 overflow-hidden flex flex-col group transition-all duration-500 hover:shadow-2xl">

        {/* Stats Summary (BarChart p-5 통일) */}
        <div className="grid grid-cols-3 divide-x divide-zinc-50 border-b border-zinc-50 bg-zinc-50/30">
          {[
            { name: "m-BERT", val: 0.511 },
            { name: "KorPatBERT", val: 0.561 },
            { name: "IPFORCE", val: 0.700 }
          ].map((item) => (
            <div key={item.name} className="p-5 flex flex-col items-center justify-center hover:bg-white transition-colors">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{item.name}</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-zinc-900 tracking-tighter">{item.val}</span>
                <span className="text-[10px] font-black text-zinc-300 uppercase">score</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Area (BarChart h-56 통일) */}
        <div className="px-6 py-6 relative">
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 20, right: 40, left: -25, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f4f4f5" strokeDasharray="0" />
                <XAxis
                  dataKey="epoch"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 800 }}
                  interval={4}
                  dy={10}
                />
                <YAxis hide domain={[0, 0.8]} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#f4f4f5', strokeWidth: 2 }} />
                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  wrapperStyle={{ top: -10, right: 0, fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px' }}
                />

                <Line type="monotone" name="m-BERT" dataKey="mBERT" stroke="#e4e4e7" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                <Line type="monotone" name="KorPat" dataKey="KorPatBERT" stroke="#93c5fd" strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                <Line
                  type="monotone"
                  name="IPFORCE"
                  dataKey="IPforce"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5, fill: '#2563eb', stroke: '#fff', strokeWidth: 2 }}
                  className="drop-shadow-[0_4px_12px_rgba(37,99,235,0.2)]"
                >
                  <LabelList content={<LastLabel />} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Bottom Summary Bar (BarChart p-4 통일) */}
        <div className="bg-zinc-900 p-4 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp size={16} className="text-blue-500" />
            <p className="text-zinc-400 text-[10px] font-bold leading-none tracking-tight">
              훈련 결과: <span className="text-white font-black uppercase">Epoch 20 (Acc: 0.7000) Achieved</span>
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
}