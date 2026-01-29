import React, { useMemo, useState } from 'react';
import { FileText, ChevronDown, PieChart as PieIcon, BarChart3 } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const getDynamicColor = (index: number) => `hsl(${(index * 137.5) % 360}, 70%, 50%)`;

export default function StatsDashboard({ stats }: { stats: any }) {
    // 🎯 부모가 관리하던 상태를 컴포넌트 내부로 가져와서 에러 방지
    const [chartToggle, setChartToggle] = useState<'pie' | 'bar'>('bar');
    const [selectedGroup, setSelectedGroup] = useState('all');

    const groupDistribution = stats?.group_distribution ?? {};

    // 🎯 데이터 가공 로직 보강
    const currentChartData = useMemo(() => {
        if (!groupDistribution) return [];

        if (selectedGroup === "all") {
            const totalMap: Record<string, { used: number; unused: number }> = {};
            Object.values(groupDistribution).flat().forEach((item: any) => {
                if (!item.name) return;
                if (!totalMap[item.name]) totalMap[item.name] = { used: 0, unused: 0 };
                totalMap[item.name].used += item.used || 0;
                totalMap[item.name].unused += item.unused || 0;
            });
            return Object.entries(totalMap).map(([name, val]) => ({
                name,
                used: val.used,
                unused: val.unused,
                total: val.used + val.unused
            }));
        }

        return (groupDistribution[selectedGroup] || []).map((item: any) => ({
            ...item,
            total: (item.used || 0) + (item.unused || 0)
        }));
    }, [groupDistribution, selectedGroup]);

    const currentTotalDocs = useMemo(() =>
        currentChartData.reduce((acc: number, cur: any) => acc + (cur.total || 0), 0),
        [currentChartData]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* 상단 컨트롤러 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 font-sans">
                <div className="bg-white rounded-3xl p-8 border shadow-xl border-zinc-100 min-w-[280px]">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2.5 bg-blue-50 rounded-xl"><FileText className="text-blue-600 w-5 h-5" /></div>
                        <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Population</h3>
                    </div>
                    <p className="text-4xl font-black text-zinc-900 tracking-tighter">
                        {currentTotalDocs.toLocaleString()}<span className="text-sm text-zinc-300 ml-2 font-bold uppercase">Assets</span>
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                    {/* 차트 토글 버튼 추가 */}
                    <div className="flex bg-zinc-100 p-1.5 rounded-2xl border shadow-inner">
                        <button onClick={() => setChartToggle('bar')} className={`p-3 rounded-xl transition-all ${chartToggle === 'bar' ? 'bg-white shadow-md text-blue-600' : 'text-zinc-400'}`}><BarChart3 size={18} /></button>
                        <button onClick={() => setChartToggle('pie')} className={`p-3 rounded-xl transition-all ${chartToggle === 'pie' ? 'bg-white shadow-md text-blue-600' : 'text-zinc-400'}`}><PieIcon size={18} /></button>
                    </div>

                    <div className="relative min-w-[300px] w-full">
                        <label className="block text-[10px] font-black text-zinc-400 mb-2 ml-1 uppercase tracking-widest">Filter by Cluster Group</label>
                        <div className="relative">
                            <select
                                value={selectedGroup}
                                onChange={(e) => setSelectedGroup(e.target.value)}
                                className="w-full appearance-none bg-white border-2 border-zinc-100 py-4 px-6 rounded-[1.5rem] focus:border-blue-500 font-black text-sm cursor-pointer shadow-sm outline-none transition-all"
                            >
                                <option value="all">전체 그룹 (All Clusters)</option>
                                {stats?.group_list?.map((g: any) => (
                                    <option key={g.code} value={g.code}>{g.code} — {g.total.toLocaleString()} objects</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-300 pointer-events-none" size={20} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 차트 영역 */}
            <div className="bg-white rounded-[3rem] border border-zinc-100 shadow-2xl overflow-hidden h-[600px] p-12">
                {currentChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {chartToggle === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={currentChartData}
                                    dataKey="total"
                                    cx="50%" cy="50%"
                                    outerRadius={180}
                                    innerRadius={110}
                                    paddingAngle={8}
                                    stroke="none"
                                    // label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                                    label={({ name, percent = 0 }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                >
                                    {currentChartData.map((_: any, i: number) => <Cell key={i} fill={getDynamicColor(i)} />)}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                                <Legend verticalAlign="bottom" iconType="circle" />
                            </PieChart>
                        ) : (
                            <BarChart data={currentChartData} layout="vertical" margin={{ left: 40, right: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f4f4f5" />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 12, fontWeight: '900', fill: '#71717a' }} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '40px' }} />
                                <Bar dataKey="used" name="CORRECT" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} barSize={32} />
                                <Bar dataKey="unused" name="COUNTER" stackId="a" fill="#f97316" radius={[0, 8, 8, 0]} barSize={32} />
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-300 gap-4 uppercase font-black tracking-widest text-xs">
                        <BarChart3 size={48} className="opacity-20" />
                        No data available for this group
                    </div>
                )}
            </div>
        </div>
    );
}