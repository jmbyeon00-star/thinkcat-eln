import React from "react";
import {
  Scale,
  FileText,
  Trash2,
  ChevronRight,
  ListTree,
  Hash,
  CheckCircle2,
  LayoutDashboard,
  Info,
  ArrowDownRight
} from "lucide-react";

type ClaimData = {
  independent_claim: string;
  dependent_claims: string[];
};

type PatentClaimProps = {
  data?: {
    application_number: string;
    claim_count?: number;
    claim?: Record<string, ClaimData>;
  };
  loading?: boolean;
};

export default function PatentClaimInfo({ data, loading = false }: PatentClaimProps) {

  const renderHighlightedText = (text: string) => {
    return <span className="text-slate-700 leading-relaxed font-medium">{text}</span>;
  };

  // --- [1] 로딩 상태 (Skeleton) ---
  if (loading || !data) {
    return (
      <div className="w-full animate-pulse space-y-10">
        <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
        <div className="bg-white rounded-[2.5rem] border border-slate-100 h-96" />
      </div>
    );
  }

  // 데이터 가공: 삭제된 항 찾기
  const deletedClaims = data.claim ? Object.entries(data.claim)
    .filter(([_, claim]) => claim.independent_claim?.trim().includes('삭제'))
    .map(([key]) => key) : [];

  const totalClaims = data.claim_count || 0;
  const independentCount = data.claim ? Object.keys(data.claim).length - deletedClaims.length : 0;

  return (
    <div className="w-full text-left font-sans pb-20 mt-20">
      {/* 🏷️ Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">독립항 / 종속항 정보</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          Independent & Dependent Claim Hierarchy
        </p>
      </div>

      {/* 🗺️ Main Container */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

        {/* [1] 다크 헤더 섹션 */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between border-b border-slate-800">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
              <Scale size={20} className="text-indigo-400" /> Claims Analysis
            </h2>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Legal Scope Definition</p>
          </div>
          <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/10 text-slate-400 text-[10px] font-black uppercase tracking-widest font-mono">
            APP: {data.application_number}
          </div>
        </div>

        {/* [2] 🎯 청구항 통계 (타이틀 바로 아래 Tile 배치) */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile label="전체 청구항" value={`${totalClaims}건`} sub="Total Claims" icon={<ListTree className="text-indigo-500" />} />
          <StatTile label="유효 독립항" value={`${independentCount}건`} sub="Active Independent" icon={<FileText className="text-emerald-500" />} />
          <StatTile label="삭제된 항" value={`${deletedClaims.length}건`} sub="Deleted/Canceled" icon={<Trash2 className="text-rose-500" />} color={deletedClaims.length > 0 ? "rose" : "indigo"} />
        </div>

        <div className="p-10 space-y-8">
          <SectionTitle title="청구항 계층 구조" />

          {/* 삭제된 독립항 알림 (존재할 경우) */}
          {deletedClaims.length > 0 && (
            <div className="bg-rose-50 border border-rose-100 rounded-[1.5rem] p-5 flex items-center gap-4">
              <div className="bg-rose-500 text-white p-2 rounded-xl shadow-lg shadow-rose-100">
                <Trash2 size={18} />
              </div>
              <p className="text-sm font-black text-rose-700 uppercase tracking-tight">
                독립항 {deletedClaims.join(', ')}번은 현재 <span className="underline decoration-2">삭제된 상태</span>입니다.
              </p>
            </div>
          )}

          {data.claim && Object.keys(data.claim).length > 0 ? (
            <div className="space-y-10">
              {Object.entries(data.claim).map(([key, claim]) => {
                if (!claim.independent_claim || claim.independent_claim.trim().includes('삭제')) return null;

                return (
                  <div key={key} className="relative group">
                    {/* 독립항 카드 */}
                    <div className="relative z-10 bg-white rounded-[2rem] border border-slate-100 shadow-sm group-hover:border-indigo-200 group-hover:shadow-xl group-hover:shadow-indigo-50/50 transition-all overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {/* 항 번호 지표 */}
                        <div className="md:w-32 bg-slate-50 flex flex-col items-center justify-center p-6 border-r border-slate-50 group-hover:bg-indigo-50 transition-colors">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Index</span>
                          <span className="text-3xl font-black text-indigo-600">{key}</span>
                        </div>
                        {/* 항 내용 */}
                        <div className="flex-1 p-8">
                          <h4 className="text-[11px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                            <CheckCircle2 size={12} /> Independent Claim
                          </h4>
                          <div className="text-[15px] font-medium leading-relaxed text-slate-800">
                            {renderHighlightedText(claim.independent_claim)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 종속항 리스트 (트리 구조) */}
                    {claim.dependent_claims && claim.dependent_claims.length > 0 && (
                      <div className="mt-4 ml-12 space-y-3 relative">
                        {/* 트리 라인 가이드 */}
                        <div className="absolute -left-6 top-0 bottom-6 border-l-2 border-slate-100" />

                        {claim.dependent_claims.map((depClaim, index) => (
                          <div key={index} className="relative flex items-start gap-3">
                            {/* 연결 커넥터 */}
                            <div className="mt-5 w-6 h-[2px] bg-slate-100" />
                            <div className="flex-1 bg-slate-50/50 rounded-[1.5rem] p-5 border border-slate-50 hover:bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50/30 transition-all">
                              <div className="flex items-center gap-2 mb-2">
                                <ArrowDownRight size={14} className="text-slate-300" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dependent Claim</span>
                              </div>
                              <div className="text-sm text-slate-600 leading-relaxed font-medium">
                                {renderHighlightedText(depClaim)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
              <Info size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-400 font-bold text-lg text-center">구성된 청구항 정보가 없습니다.</p>
            </div>
          )}
        </div>

        {/* 🏁 Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle2 size={12} className="text-emerald-500" /> Statutory Patent Claim Structure Verified
          </p>
          <div className="flex items-center gap-1 opacity-30">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-1 w-4 rounded-full bg-slate-400" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- [Sub Components] ---

function StatTile({ label, value, sub, icon, color = "indigo" }: any) {
  return (
    <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span>
      </div>
      <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'rose' ? 'text-rose-600' : 'text-slate-900'}`}>
        {value}
      </div>
      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-2 mb-2">
      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}