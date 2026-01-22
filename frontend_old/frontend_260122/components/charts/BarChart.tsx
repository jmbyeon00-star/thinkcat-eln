import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import { Sparkles, TrendingUp } from "lucide-react";

const barData = [
  { model: "m-BERT", accuracy: 51.1, color: "#e4e4e7" },
  { model: "KorPatBERT", accuracy: 56.1, color: "#93c5fd" },
  { model: "IP-Force", accuracy: 70.0, color: "#2563eb" },
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-900 px-3 py-2 rounded-xl shadow-2xl border border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black text-white">{payload[0].payload.model}</span>
          <span className="text-[11px] font-black text-blue-400">{payload[0].value}%</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function ModelAccuracyBarChart() {
  const baselineModel = barData[0];
  const bestModel = barData[barData.length - 1];
  const improvement = ((bestModel.accuracy - baselineModel.accuracy) / baselineModel.accuracy * 100).toFixed(1);

  return (
    <div className="w-full max-w-5xl mx-auto py-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      {/* 1. Header: 작고 세련되게 변경 */}
      <div className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-black tracking-tighter text-zinc-900 leading-none">
            성능 분석 리포트<span className="text-blue-600">.</span>
          </h2>
          <div className="hidden md:flex items-center gap-2 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
            <Sparkles size={10} className="fill-blue-600" />
            <span className="text-[9px] font-black uppercase tracking-widest">Benchmark</span>
          </div>
        </div>
        <p className="text-zinc-400 text-xs font-bold hidden sm:block">Korean Patent CPC Dataset</p>
      </div>

      {/* 2. Main Card: 높이 대폭 압축 */}
      <div className="bg-white rounded-[2rem] border border-zinc-100 shadow-xl shadow-zinc-200/40 overflow-hidden">

        {/* Stats Summary: 텍스트 크기를 줄이고 높이를 압축(p-8 -> p-5) */}
        <div className="grid grid-cols-3 divide-x divide-zinc-50 border-b border-zinc-50 bg-zinc-50/30">
          {barData.map((item) => (
            <div key={item.model} className="p-5 flex flex-col items-center justify-center group hover:bg-white transition-colors">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">{item.model}</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-2xl font-black text-zinc-900 tracking-tighter group-hover:text-blue-600 transition-colors">{item.accuracy}</span>
                <span className="text-sm font-black text-zinc-300">%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Area: 차트 높이 축소 (h-80 -> h-56) */}
        <div className="px-6 py-6 relative">
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 20, right: 20, left: -30, bottom: 0 }}
              >
                <CartesianGrid vertical={false} stroke="#f4f4f5" strokeDasharray="0" />
                <XAxis
                  dataKey="model"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#a1a1aa', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis hide domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc', radius: 12 }} />

                <Bar
                  dataKey="accuracy"
                  radius={[10, 10, 10, 10]}
                  barSize={60}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList
                    dataKey="accuracy"
                    position="top"
                    offset={10}
                    content={(props: any) => {
                      const { x, y, width, value } = props;
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 8}
                          fill={value === 70.0 ? "#2563eb" : "#d4d4d8"}
                          textAnchor="middle"
                          className="text-[13px] font-black tracking-tighter"
                        >
                          {value}%
                        </text>
                      );
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Footer: 높이 축소 (p-6 -> p-4) */}
        <div className="bg-zinc-900 p-4 px-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp size={16} className="text-blue-500" />
            <p className="text-zinc-400 text-[10px] font-bold">
              m-BERT 대비 <span className="text-white font-black">{improvement}% 성능 향상</span> 달성
            </p>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
        </div>
      </div>
    </div>
  );
}