import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  XCircle,
  History,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Info
} from "lucide-react";
import { patentByNpecheck } from "@/lib/api";

type NpeItem = {
  reg_number: string;
  rgt_trnsf_seq: number;
  rgtr_seq: number;
  rgtr_cd: string;
  rgtr_nm: string;
  npe_prob: number;
};

export default function PatLitigation({ applicationNumber }: { applicationNumber: string }) {
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

  // --- [데이터 가공 로직] ---
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

  const getRiskStatus = (prob: number) => {
    if (prob === 0) return { color: "text-slate-400", bg: "bg-slate-50", border: "border-slate-100", label: "No Data", icon: <XCircle size={14} /> };
    if (prob >= 0.99933) return { color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", label: "매우 높음", icon: <AlertCircle size={14} /> };
    if (prob >= 0.99924) return { color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100", label: "높음", icon: <AlertTriangle size={14} /> };
    if (prob >= 0.69892) return { color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", label: "중간", icon: <AlertTriangle size={14} /> };
    return { color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", label: "낮음", icon: <CheckCircle size={14} /> };
  };

  // 통계
  const stats = {
    high: npeData.filter(item => item.npe_prob >= 0.99933).length,
    medium: npeData.filter(item => item.npe_prob >= 0.69892 && item.npe_prob < 0.99933).length,
    low: npeData.filter(item => item.npe_prob > 0 && item.npe_prob < 0.69892).length,
  };

  if (isLoading) {
    return (
      <div className="w-full animate-pulse space-y-10">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-96" />
      </div>
    );
  }

  return (
    <div className="w-full text-left font-sans">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
          권리자 이전 분석
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          NPE Risk Assessment & Ownership Transfer History
        </p>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">

        {/* Top Dark Header */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <History size={20} className="text-indigo-400" /> 이전 내역 분석
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              Historical Ownership Data
            </p>
          </div>
          <ShieldAlert size={32} className="text-slate-700" />
        </div>

        {npeData.length > 0 ? (
          <>
            {/* Stats Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-50">
              <RiskStatCard label="고위험 NPE 가능성" count={stats.high} color="rose" desc="심각한 주의 필요" />
              <RiskStatCard label="중위험 이전 내역" count={stats.medium} color="amber" desc="모니터링 권장" />
              <RiskStatCard label="안전/저위험 내역" count={stats.low} color="emerald" desc="안전 수준" />
            </div>

            {/* Content Table Area */}
            <div className="p-10">
              <SectionTitle title="상세 이전 타임라인" />
              <div className="mt-8 overflow-hidden rounded-[2rem] border border-slate-100 shadow-inner-sm">
                <table className="min-w-full border-separate border-spacing-0">
                  <thead className="bg-slate-50">
                    <tr>
                      {["이전 번호", "권리자번호", "출원번호", "등록번호", "권리자이름", "권리자코드", "NPE 위험도"].map((head) => (
                        <th key={head} className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-50">
                    {groupedData.map((group, gIdx) =>
                      group.map((item, iIdx) => {
                        const key = `${gIdx}-${iIdx}`;
                        const risk = getRiskStatus(item.npe_prob);
                        return (
                          <tr
                            key={key}
                            className={`group transition-colors ${hoveredRow === key ? 'bg-indigo-50/30' : ''}`}
                            onMouseEnter={() => setHoveredRow(key)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            {iIdx === 0 && (
                              <td rowSpan={group.length} className="px-6 py-4 align-top border-r border-slate-50">
                                <span className="text-lg font-black text-indigo-600">#{item.rgt_trnsf_seq}</span>
                              </td>
                            )}
                            <td className="px-6 py-4 text-sm font-bold text-slate-400">
                              {item.rgtr_seq.toString().padStart(2, '0')}
                            </td>

                            <td className="px-6 py-4 text-sm font-bold text-slate-400">
                              {applicationNumber}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-400">
                              {item.reg_number}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold text-slate-400">
                              <span className="text-sm font-black text-slate-900 group-hover/link:text-indigo-600 transition-colors">
                                {item.rgtr_nm}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <div
                                className="flex flex-col cursor-pointer group/link"
                                onClick={() => handleClick(item.rgtr_cd)}
                              >
                                <span className="text-[15px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                  {item.rgtr_cd || "CODE N/A"} <ExternalLink size={10} />
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${risk.bg} ${risk.color} ${risk.border}`}>
                                {risk.icon}
                                <span className="text-[11px] font-black uppercase tracking-tight">{risk.label}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Legend Box */}
              <div className="mt-10 bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Info size={14} className="text-indigo-500" /> NPE Risk Methodology
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                  <LegendItem prob="≥ 0.99933" label="매우 높음" color="bg-rose-500" />
                  <LegendItem prob="≥ 0.99924" label="위험/높음" color="bg-orange-500" />
                  <LegendItem prob="≥ 0.69892" label="주의/중간" color="bg-amber-500" />
                  <LegendItem prob="< 0.69892" label="안전/낮음" color="bg-emerald-500" />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-24 text-center">
            <XCircle size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">권리자 이전 데이터가 존재하지 않습니다.</p>
          </div>
        )}

        {/* Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {/* <CheckCircle2 size={12} className="text-indigo-500" />  */}
            💡 권리자 코드를 클릭하면 해당 기업의 상세 정보를 확인할 수 있습니다.
          </p>
          <p className="text-[10px] font-black text-slate-300 italic">
            Reference No: {applicationNumber}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- [Sub Components] ---

function RiskStatCard({ label, count, color, desc }: any) {
  const colors: any = {
    rose: "text-rose-600 border-rose-100",
    amber: "text-amber-600 border-amber-100",
    emerald: "text-emerald-600 border-emerald-100",
  };
  return (
    <div className={`bg-white rounded-[1.5rem] p-6 border shadow-sm ${colors[color]}`}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
      <div className="text-3xl font-black my-1">{count}<span className="text-sm ml-1 opacity-50">건</span></div>
      <p className="text-[9px] font-bold uppercase tracking-tight opacity-40">{desc}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
      <div className="w-1 h-3 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}

function LegendItem({ prob, label, color }: any) {
  return (
    <div className="flex flex-col gap-1.5 text-left">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="text-xs font-black text-slate-700">{label}</span>
      </div>
      <span className="text-[10px] font-bold text-slate-400 ml-4">{prob}</span>
    </div>
  );
}