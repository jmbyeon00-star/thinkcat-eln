"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, AlertTriangle, CheckCircle, XCircle, ArrowRightLeft, Activity, Info } from "lucide-react";
import { patentByNpecheck } from "@/lib/api"; 

type NpeItem = {
  reg_number: string;
  rgt_trnsf_seq: number;
  rgtr_seq: number;
  rgtr_cd: string;
  rgtr_nm: string;
  npe_prob: number;
};

type PatLitigationProps = {
  applicationNumber: string;
};

export default function PatLitigation({ applicationNumber }: PatLitigationProps) {
  const [npeData, setNpeData] = useState<NpeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!applicationNumber) return;
    setIsLoading(true);

    patentByNpecheck(applicationNumber)
      .then((data) => setNpeData(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [applicationNumber]);

  const handleClick = (code?: string) => {
    if (code) router.push(`/search/company/${code}`);
  };

  const groupByRGT_TRNSF_SEQ = (data: NpeItem[]) => {
    const grouped: Record<string, NpeItem[]> = {};
    data.forEach((item) => {
      const key = item.rgt_trnsf_seq.toString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });
    return Object.values(grouped);
  };

  const groupedData = groupByRGT_TRNSF_SEQ(npeData);

  const getColor = (prob: number) => {
    if (prob === 0) return { color: "#94a3b8", label: "데이터 없음", icon: <XCircle size={18} /> };
    if (prob >= 0.99933) return { color: "#e11d48", label: "매우 높음", icon: <AlertCircle size={18} /> };
    if (prob >= 0.99924) return { color: "#f97316", label: "높음", icon: <AlertTriangle size={18} /> };
    if (prob >= 0.69892) return { color: "#eab308", label: "중간", icon: <AlertTriangle size={18} /> };
    return { color: "#10b981", label: "낮음", icon: <CheckCircle size={18} /> };
  };

  if (isLoading) return <div className="w-full h-64 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;

  return (
    <div className="w-full text-left font-sans">
      {/* 🏷️ 상단 제목 영역 */}
      <div className="mb-8 flex items-start gap-4">
        <ArrowRightLeft className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            권리자 이전 분석
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            NPE(Non-Practicing Entity) 위험도 및 권리 변동 평가
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
                권리자 이전 내역
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                Rights Holder Transfer History & NPE Risk
              </p>
            </div>
          </div>
        </div>

        {npeData.length > 0 ? (
          <>
            <div className="p-8 space-y-8">
              <SectionTitle title="상세 이전 내역" />

              {/* 테이블 영역 */}
              <div className="overflow-x-auto rounded-2xl border border-slate-100 shadow-sm">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead className="bg-slate-50/50">
                    <tr>
                      {/* [수정] text-center 적용으로 컬럼명 가운데 정렬 */}
                      {["이전번호", "권리자번호", "출원번호", "등록번호", "권리자이름", "권리자코드", "NPE 위험도"].map((header) => (
                        <th key={header} className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {groupedData.map((group, gIdx) =>
                      group.map((item, iIdx) => {
                        const key = `${gIdx}-${iIdx}`;
                        const colorData = getColor(item.npe_prob);
                        return (
                          <tr
                            key={key}
                            className={`${
                              hoveredRow === key ? "bg-indigo-50/30" : "bg-white"
                            } transition-colors cursor-default`}
                            onMouseEnter={() => setHoveredRow(key)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            {iIdx === 0 && (
                              <td rowSpan={group.length} className="px-5 py-4 text-sm font-bold text-indigo-600 text-center border-r border-slate-50">
                                {item.rgt_trnsf_seq}
                              </td>
                            )}
                            <td className="px-5 py-4 text-sm text-slate-600 font-medium font-mono text-center">{item.rgtr_seq}</td>
                            <td className="px-5 py-4 text-sm text-slate-500 font-mono text-center">{applicationNumber}</td>
                            <td className="px-5 py-4 text-sm text-slate-500 font-mono text-center">{item.reg_number}</td>
                            <td className="px-5 py-4 text-sm font-bold text-slate-900">{item.rgtr_nm}</td>
                            <td 
                              className="px-5 py-4 text-sm text-indigo-600 font-bold hover:underline cursor-pointer text-center" 
                              onClick={() => handleClick(item.rgtr_cd)}
                            >
                              {item.rgtr_cd || "N/A"}
                            </td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-100 bg-white shadow-sm w-fit mx-auto">
                                <div style={{ color: colorData.color }}>{colorData.icon}</div>
                                <span className="text-[10px] font-black" style={{ color: colorData.color }}>
                                  {colorData.label}
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* [수정] 범례 디자인 - 초연한 그라데이션, 검정 텍스트, 컬러 아이콘 적용 */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Activity size={16} className="text-indigo-600" />
                  <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">NPE 위험도 범례</h4>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {[
                    { label: "매우 높음", prob: "≥0.99933", from: "#fff1f2", to: "#fecdd3", iconColor: "#e11d48", icon: <AlertCircle size={14} /> },
                    { label: "높음", prob: "≥0.99924", from: "#fff7ed", to: "#ffedd5", iconColor: "#f97316", icon: <AlertTriangle size={14} /> },
                    { label: "중간", prob: "≥0.69892", from: "#fefce8", to: "#fef9c3", iconColor: "#ca8a04", icon: <AlertTriangle size={14} /> },
                    { label: "낮음", prob: "<0.69892", from: "#f0fdf4", to: "#dcfce7", iconColor: "#10b981", icon: <CheckCircle size={14} /> },
                    { label: "데이터 없음", prob: "prob === 0", from: "#f8fafc", to: "#f1f5f9", iconColor: "#64748b", icon: <XCircle size={14} /> },
                  ].map((legend) => (
                    <div 
                      key={legend.label} 
                      style={{ background: `linear-gradient(135deg, ${legend.from} 0%, ${legend.to} 100%)` }}
                      className="flex items-center gap-2 px-3 py-3 rounded-xl border border-slate-100/50 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
                    >
                      {/* 아이콘 색상은 상징색(To) 계열로 설정 */}
                      <div style={{ color: legend.iconColor }} className="shrink-0">
                        {legend.icon}
                      </div>
                      <div className="flex flex-col min-w-0">
                        {/* 텍스트 색상은 검정색으로 통일 */}
                        <span className="text-[10px] font-black text-black truncate">
                          {legend.label}
                        </span>
                        {/* <span className="text-[9px] font-bold text-slate-500 font-mono tracking-tighter truncate">
                          {legend.prob}
                        </span> */}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 🏁 푸터 */}
            <div className="px-8 py-5 bg-slate-50/50 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 flex items-center gap-2 uppercase tracking-wider">
                <Info size={12} className="text-indigo-500" /> 권리자 코드를 클릭하면 해당 기업의 상세 페이지로 이동합니다.
              </p>
            </div>
          </>
        ) : (
          <div className="p-20 text-center bg-slate-50/30">
            <XCircle size={48} className="text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-sm">권리자 이전 데이터가 없습니다.</p>
            <p className="text-slate-300 text-xs mt-1 uppercase tracking-widest font-medium">No Transfer History Detected</p>
          </div>
        )}
      </div>
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