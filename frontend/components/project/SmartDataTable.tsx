import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Trash2, AlertTriangle, Sparkles } from "lucide-react";
import { ProjectData } from "@/types/project";


interface SmartDataTableProps {
    data: ProjectData[];
    setData: React.Dispatch<React.SetStateAction<ProjectData[]>>;
}

export default function SmartDataTable({ data, setData }: SmartDataTableProps) {
    const [page, setPage] = useState(1);
    const itemsPerPage = 10;

    // --- 🎯 1. 내부 로직: 데이터 수정/삭제 ---
    const handleEdit = (idx: number, key: keyof ProjectData, value: any) => {
        setData(prev => prev.map((item, i) => i === idx ? { ...item, [key]: value } : item));
    };

    const handleRemove = (idx: number) => {
        // if (!confirm("정말 삭제하시겠습니까?")) return;
        setData(prev => prev.filter((_, i) => i !== idx));
    };

    // --- 🎯 2. 내부 로직: 엄격한 중복 체크 (공백 제거 및 소문자화) ---
    const getUniqueKey = (item: ProjectData) => {
        // 공백과 대소문자 차이로 인해 중복이 안 잡히는 것을 방지
        const appNum = String(item.application_number || "").trim().toLowerCase();
        const title = String(item.title || "").trim().toLowerCase();
        const abstract = String(item.abstract || "").trim().toLowerCase();
        return `${appNum}|${title}|${abstract}`;
    };

    // 중복된 키들만 모은 Set (배경색 하이라이트용)
    const duplicateKeys = useMemo(() => {
        const seen = new Set<string>();
        const duplicates = new Set<string>();
        data.forEach(item => {
            const key = getUniqueKey(item);
            if (seen.has(key)) duplicates.add(key);
            seen.add(key);
        });
        return duplicates;
    }, [data]);

    const handleClean = () => {
        const uniqueMap = new Map();
        data.forEach(item => uniqueMap.set(getUniqueKey(item), item));
        setData(Array.from(uniqueMap.values()));
    };

    // --- 🎯 3. 내부 로직: 동적 컬럼 구성 (출원번호 존재 여부 체크) ---
    const columns = useMemo(() => {
        const cols = [];

        // 데이터 중 하나라도 application_number가 있는 경우에만 컬럼 추가
        if (data.some(item => item.application_number && String(item.application_number).trim() !== "")) {
            cols.push({
                header: "App Number",
                width: "15%",
                render: (item: ProjectData, idx: number) => (
                    <input
                        value={item.application_number || ""}
                        onChange={(e) => handleEdit(idx, "application_number", e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-mono text-[11px] text-zinc-500"
                    />
                )
            });
        }

        cols.push(
            {
                header: "Title",
                width: "30%",
                render: (item: ProjectData, idx: number) => (
                    <input
                        value={item.title}
                        onChange={(e) => handleEdit(idx, "title", e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-sm text-zinc-800"
                    />
                )
            },
            {
                header: "Abstract",
                render: (item: ProjectData, idx: number) => (
                    <textarea
                        rows={1}
                        value={item.abstract}
                        onChange={(e) => handleEdit(idx, "abstract", e.target.value)}
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-zinc-500 text-xs resize-none"
                    />
                )
            },
            {
                header: "Label (Edit)",
                width: "150px",
                render: (item: ProjectData, idx: number) => (
                    <input
                        value={item.collection_name}
                        onChange={(e) => handleEdit(idx, "collection_name", e.target.value)}
                        className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-[10px] font-black border-none w-full outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                )
            }
        );
        return cols;
    }, [data]);

    // 페이지네이션
    const totalPages = Math.ceil(data.length / itemsPerPage) || 1;
    const startIndex = (page - 1) * itemsPerPage;
    const currentData = data.slice(startIndex, startIndex + itemsPerPage);

    return (
        <div className="w-full space-y-4 animate-in fade-in duration-500">
            {/* 🚨 중복 알림 바 */}
            {duplicateKeys.size > 0 && (
                <div className="flex items-center justify-between mt-4 px-6 py-4 bg-rose-50 border border-rose-100 rounded-[2rem] shadow-sm">
                    <div className="flex items-center gap-3 text-rose-600">
                        <AlertTriangle size={20} className="animate-pulse" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-tight">Duplicate Records Detected</p>
                            <p className="text-[10px] font-bold opacity-70">모든 필드가 일치하는 데이터 세트가 발견되었습니다.</p>
                        </div>
                    </div>
                    <button onClick={handleClean} className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 text-white rounded-2xl text-[10px] font-black uppercase hover:bg-rose-700 transition-all shadow-lg active:scale-95">
                        <Sparkles size={14} /> 중복 일괄 정리
                    </button>
                </div>
            )}

            <div className="overflow-hidden rounded-[2.5rem] mt-4 border border-zinc-200 bg-white shadow-xl">
                <table className="min-w-full text-left text-sm border-collapse">
                    <thead className="bg-zinc-50/80 border-b">
                        <tr className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                            <th className="px-8 py-5 w-16 text-center">No.</th>
                            {columns.map((col, idx) => (
                                <th key={idx} className="px-6 py-5" style={{ width: col.width }}>{col.header}</th>
                            ))}
                            <th className="px-8 py-5 w-20 text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                        {currentData.map((item, idx) => {
                            const realIndex = startIndex + idx;
                            const isDuplicate = duplicateKeys.has(getUniqueKey(item));

                            return (
                                <tr key={item.id || realIndex} className={`transition-all group ${isDuplicate ? 'bg-rose-50/40' : 'hover:bg-blue-50/30'}`}>
                                    <td className="px-8 py-5 text-center">
                                        {isDuplicate ? <AlertTriangle size={16} className="text-rose-400 mx-auto" /> : <span className="text-zinc-300 font-mono text-xs font-bold">{realIndex + 1}</span>}
                                    </td>
                                    {columns.map((col, colIdx) => (
                                        <td key={colIdx} className="px-6 py-5">
                                            {col.render(item, realIndex)}
                                        </td>
                                    ))}
                                    <td className="px-8 py-5 text-center">
                                        <button onClick={() => handleRemove(realIndex)} className="p-2 text-zinc-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100">
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* 페이지네이션 */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center px-10 py-5 border-t bg-zinc-50/30">
                        <div className="flex gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded-xl disabled:opacity-20"><ChevronLeft size={16} /></button>
                            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded-xl disabled:opacity-20"><ChevronRight size={16} /></button>
                        </div>
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{page} / {totalPages} Pages</span>
                    </div>
                )}
            </div>
        </div>
    );
}