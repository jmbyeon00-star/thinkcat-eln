"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import {
  UserCheck,
  Users,
  Building,
  LayoutDashboard,
  Target,
  Info
} from "lucide-react";
import { agentRecommend } from "@/lib/api";
import { useTranslations } from "next-intl";

interface PatentResult {
  app_number: string;
  l2_distance: number;
  agent_code: string;
  name_ko: string;
  company_ko: string;
  address_ko: string;
}

interface ApiResponse {
  success: boolean;
  total_count: number;
  data: PatentResult[];
}

interface AgentNavigationProps {
  applicationNumber: string;
  code: string;
}

export default function AgentNavigation({ applicationNumber, code }: AgentNavigationProps) {
  const router = useRouter();
  const t = useTranslations("patent.agent");
  const tCommon = useTranslations("common");
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleClick = (agentCode: string) => {
    if (agentCode) {
      router.push(`/agent/${agentCode}`);
    }
  };

  const handleCompanyClick = (companyName: string) => {
    if (companyName) {
      router.push(`/agent/${encodeURIComponent(companyName)}`);
    }
  };

  // 주소 축약 함수
  const truncateAddress = (address: string, maxLength: number = 50) => {
    if (address.length <= maxLength) return address;
    return address.substring(0, maxLength) + '...';
  };

  useEffect(() => {
    if (!applicationNumber || !code) return;

    setLoading(true);
    setError(null);

    agentRecommend(applicationNumber, code)
      .then((data) => {
        if (data && typeof data === 'object') {
          setResults(data as ApiResponse);
        }
      })
      .catch((err) => {
        console.error("대리인 추천 데이터 로딩 실패:", err);
      })
      .finally(() => setLoading(false));
  }, [applicationNumber, code]);

  // --- Loading State ---
  if (loading) {
    return (
      <div className="w-full animate-pulse space-y-10 mt-20">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[500px]" />
      </div>
    );
  }

  // --- Error State ---
  if (error) {
    return (
      <div className="w-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 mt-20">
        <Info className="mx-auto text-slate-300 mb-4" size={48} />
        <p className="text-slate-500 font-bold">{tCommon("error")}</p>
      </div>
    );
  }

  // --- Empty State ---
  if (!results || !results.success || results.data.length === 0) {
    return (
      <div className="w-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200 mt-20">
        <Users className="mx-auto text-slate-300 mb-4" size={48} />
        <p className="text-slate-500 font-bold">{tCommon("noData")}</p>
      </div>
    );
  }

  // 해당특허(l2_distance === 0)와 추천 대리인 분리
  const myPatents = results.data.filter(item => item.l2_distance === 0);
  const recommendations = results.data.filter(item => item.l2_distance !== 0);

  return (
    <div className="w-full text-left font-sans pb-20 mt-20">
      {/* 🏷️ Page Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">{t("title")}</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          {t("subtitle")}
        </p>
      </div>

      {/* 🗺️ Main Card Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

        {/* [1] 타이틀 섹션 */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <LayoutDashboard size={20} className="text-indigo-400" /> {t("title")}
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
              {t("subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
            <Target size={14} className="text-indigo-400" />
            <span className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">{code}</span>
          </div>
        </div>

        {/* [2] 🎯 핵심 통계 지표 */}
        <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-50 border-b border-slate-100">
          <StatTile
            label={t("currentAgent")}
            value={`${myPatents.length}${tCommon("items")}`}
            sub="Current Patent"
            icon={<UserCheck className="text-indigo-500" />}
          />
          <StatTile
            label={t("recommendations")}
            value={`${recommendations.length}${tCommon("items")}`}
            sub="Recommendations"
            icon={<Users className="text-emerald-500" />}
            color="emerald"
          />
        </div>

        {/* [3] 📊 추천 대리인 목록 */}
        <div className="p-10 bg-white">
          <div className="mb-6">
            <SectionTitle title={t("recommendations")} />
          </div>

          <div className="overflow-x-auto rounded-[1.5rem] border border-slate-100">
            <table className="min-w-full bg-white">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-center text-[15px] font-semibold text-slate-700">
                    {t("rank")}
                  </th>
                  <th className="px-6 py-4 text-center text-[15px] font-semibold text-slate-700">
                    {t("company")}
                  </th>
                  <th className="px-6 py-4 text-center text-[15px] font-semibold text-slate-700">
                    {t("address")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {/* 해당특허 행 (모든 컬럼 통합) */}
                {myPatents.length > 0 && (
                  <tr className="bg-indigo-50/50">
                    <td className="px-6 py-5 whitespace-nowrap text-[15px] text-center">
                      <span className="inline-flex items-center px-4 py-1.5 rounded-full text-[13px] font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                        {t("currentAgent")}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-[15px] font-medium text-center">
                      {[...new Set(myPatents.map(p => p.company_ko))].map((company, idx, arr) => (
                        <span key={idx}>
                          <span
                            className="cursor-pointer text-indigo-600 hover:text-indigo-800 hover:underline font-medium"
                            onClick={() => handleCompanyClick(company)}
                          >
                            {company}
                          </span>
                          {idx < arr.length - 1 && ', '}
                        </span>
                      ))}
                    </td>
                    <td className="px-6 py-5 text-[15px] text-slate-600 text-center font-medium" title={[...new Set(myPatents.map(p => p.address_ko))].join(', ')}>
                      {truncateAddress([...new Set(myPatents.map(p => p.address_ko))].join(', '))}
                    </td>
                  </tr>
                )}

                {/* 추천 대리인 행 */}
                {recommendations.map((item, index) => (
                  <tr
                    key={item.app_number}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <span className="text-lg font-medium text-slate-900">{index + 1}</span>
                    </td>
                    <td
                      className="px-6 py-5 text-[15px] font-medium text-center text-indigo-600 cursor-pointer hover:text-indigo-800 hover:underline"
                      onClick={() => handleCompanyClick(item.company_ko)}
                    >
                      {item.company_ko}
                    </td>
                    <td className="px-6 py-5 text-[15px] text-slate-600 text-center font-medium" title={item.address_ko}>
                      {truncateAddress(item.address_ko)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 🏁 Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            💡 유사한 기술 분야의 특허를 출원한 대리인을 추천합니다. 대리인 이름을 클릭하면 상세 정보를 확인할 수 있습니다.
          </p>
          <span className="text-[12px] font-black text-slate-300 italic">App No.: {applicationNumber}</span>
        </div>
      </div>
    </div>
  );
}

// --- [재사용 컴포넌트] ---

function StatTile({ label, value, sub, icon, color = "indigo" }: any) {
  return (
    <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        {/* <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span> */}
        <span className="text-sm font-medium text-slate-500">{label}</span>
      </div>
      <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'emerald' ? 'text-emerald-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    // <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]">
    <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}
