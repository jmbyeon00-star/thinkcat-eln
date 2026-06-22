"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import { agentRecommend } from "@/lib/api";
import { UserCheck, CheckCircle2, MapPin, Building2 } from "lucide-react";
import EmptyDataNotice from "./EmptyDataNotice";

interface PatentResult {
  app_number: string;
  is_mine: boolean;      // l2_distance 대신
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

export default function AgentRecommendTable({ applicationNumber, code }: AgentNavigationProps) {
  const router = useRouter();
  const [results, setResults] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleCompanyClick = (companyName: string) => {
    if (companyName) {
      router.push(`/attorney/${encodeURIComponent(companyName)}`);
    }
  };

  const truncateAddress = (address: string, maxLength: number = 45) => {
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
        setError("데이터 로딩 실패");
      })
      .finally(() => setLoading(false));
  }, [applicationNumber, code]);

  if (loading) return <div className="w-full h-96 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;

  if (error || !results || !results.success || results.data.length === 0) {
    return (
      <EmptyDataNotice
        icon={UserCheck}
        title="추천 대리인 데이터가 없습니다"
        description={"분석 데이터셋에 아직 포함되지 않은 특허일 수 있어요.\n주로 오래되었거나 등록 정보가 충분하지 않은 특허에서 나타납니다."}
      />
    );
  }

  // const myPatents = results.data.filter(item => item.l2_distance === 0);
  // const recommendations = results.data.filter(item => item.l2_distance !== 0);

  const myPatents = results.data.filter(item => item.is_mine);
  const recommendations = results.data.filter(item => !item.is_mine);

  return (
    <div className="w-full text-left font-sans space-y-6">
      {/* 🏷️ 상단 제목 영역 */}
      <div className="mb-8 flex items-start gap-4">
        <UserCheck className="text-indigo-600 shrink-0 mt-1" size={56} /> 
        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            추천 대리인 분석
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            유사 특허 기반 최적 대리인 추천 리포트
          </p>
        </div>
      </div>
      
      {/* 🗺️ 메인 카드 컨테이너 */}
      
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        {/* 카드 헤더 (Navy Theme) */}
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-tighter">
              추천 결과 리스트
            </h2>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
              Agent Recommendation Result List
            </p>
          </div>
        </div>

        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 px-1">
              <div className="w-1 h-3 bg-indigo-600 rounded-full" />
              유사 기술 분야 전문 대리인
            </h3>
          </div>
          
          <div className="overflow-hidden border border-slate-100 rounded-2xl shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">순위</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">사무소명</th>
                  <th className="px-6 py-4 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">주소</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-50">
                {/* [상단 고정] 해당특허 행 */}
                {myPatents.length > 0 && (
                  <tr className="bg-indigo-50/30">
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black bg-indigo-600 text-white uppercase tracking-tighter">
                        CURRENT
                      </span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {[...new Set(myPatents.map(p => p.company_ko))].map((company, idx, arr) => (
                          <span 
                            key={idx}
                            className="text-sm font-black text-indigo-700 cursor-pointer hover:underline"
                            onClick={() => handleCompanyClick(company)}
                          >
                            {company}{idx < arr.length - 1 && ','}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-500 font-bold">
                        <MapPin size={14} />
                        {truncateAddress([...new Set(myPatents.map(p => p.address_ko))].join(', '))}
                      </div>
                    </td>
                  </tr>
                )}
                
                {/* 추천 대리인 행 */}
                {recommendations.map((item, index) => (
                  <tr key={item.app_number} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-5 whitespace-nowrap text-center">
                      <span className="text-lg font-black text-slate-300 group-hover:text-indigo-500 transition-colors">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                    </td>
                    <td 
                      className="px-6 py-5 text-sm font-bold text-center text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => handleCompanyClick(item.company_ko)}
                    >
                      {item.company_ko}
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-500 text-center font-medium">
                      {truncateAddress(item.address_ko)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-8 py-5 bg-slate-50 border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-wider">
            <CheckCircle2 size={12} className="text-emerald-500" /> 
            전문 대리 사무소 추천합니다. 추천사무소를 클릭하여 상세정보를 확인하세요.
          </p>
        </div>
      </div>
    </div>
  );
}


