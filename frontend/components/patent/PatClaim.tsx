"use client";
import React from "react";
import { Trash2, CheckCircle2, ArrowDownRight } from "lucide-react";

type ClaimData = {
  independent_claim: string;
  dependent_claims: string[];
};

type PatentClaimProps = {
  data?: {
    application_number: string;
    claim?: Record<string, ClaimData>;
  };
  loading?: boolean;
};

export default function PatentClaimInfo({ data, loading = false }: PatentClaimProps) {
  if (loading || !data) {
    return <div className="w-full h-32 bg-slate-50 animate-pulse rounded-2xl border border-slate-100" />;
  }

  // 텍스트 강조 렌더링
  const renderText = (text: string) => (
    <span className="text-slate-700 leading-relaxed font-medium">{text}</span>
  );

  return (
    <div className="w-full">
      {/* 메인 카드 영역 */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
        
        {/* 네이비 헤더 */}
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-black text-white tracking-tighter">
                독립항 / 종속항 정보
              </h1>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                INDEPENDENT & DEPENDENT CLAIM HIERARCHY
              </p>
            </div>
          </div>
        </div>

        {/* 본문 내용 */}
        <div className="p-8 space-y-8">
          <h3 className="flex items-center gap-2 text-[15px] font-bold text-slate-800">
            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            청구 범위 상세
          </h3>

          {data.claim && Object.keys(data.claim).length > 0 ? (
            <div className="space-y-10">
              {/* [핑크 박스] 삭제된 항 안내 */}
              {(() => {
                const deletedClaims = Object.entries(data.claim)
                  .filter(([_, claim]) => claim.independent_claim?.trim().includes('삭제'))
                  .map(([key]) => key);

                if (deletedClaims.length > 0) {
                  return (
                    <div className="bg-[#fff1f2] border border-[#fecdd3] rounded-2xl p-5 flex items-center gap-4">
                      <div className="bg-[#f43f5e] p-2 rounded-xl shadow-lg shadow-rose-100">
                        <Trash2 size={18} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-[#be123c]">
                        독립항 {deletedClaims.join(', ')} 청구항 삭제됨
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              {/* 실제 청구항 출력 */}
              {Object.entries(data.claim).map(([key, claim]) => {
                if (!claim.independent_claim || claim.independent_claim.trim().includes('삭제')) return null;

                return (
                  <div key={key} className="relative group">
                    {/* 독립항 카드 */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden group-hover:border-indigo-200 group-hover:shadow-md transition-all">
                      <div className="flex flex-col md:flex-row">
                        <div className="md:w-24 bg-slate-50 flex flex-col items-center justify-center p-6 border-r border-slate-50 group-hover:bg-indigo-50 transition-colors">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">독립항</span>
                          <span className="text-3xl font-black text-indigo-600">{key}</span>
                        </div>
                        <div className="flex-1 p-7">
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={14} className="text-indigo-500" />
                            <span className="text-[11px] font-black text-indigo-500 uppercase tracking-widest">독립항 {key}</span>
                          </div>
                          <div className="text-[15px] leading-relaxed">
                             {renderText(`[${key}] ${claim.independent_claim}`)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* [수정] 종속항 트리 구조 - 인덱스를 앞으로 이동 및 Dependent 삭제 */}
                    {claim.dependent_claims?.length > 0 && (
                      <div className="mt-4 ml-12 space-y-3 relative">
                        <div className="absolute -left-6 top-0 bottom-6 border-l-2 border-slate-100" />
                        
                        {claim.dependent_claims.map((dep, idx) => {
                          // 종속항 내용에서 번호 추출
                          const depMatch = dep.match(/\[(\d+)\]/);
                          const depNumber = depMatch ? depMatch[1] : `${idx + 1}`;

                          return (
                            <div key={idx} className="relative flex items-start gap-3">
                              <div className="mt-5 w-6 h-[2px] bg-slate-200" />
                              <div className="flex-1 bg-slate-50/50 rounded-2xl p-5 border border-slate-50 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all">
                                <div className="flex items-center gap-2 mb-2">
                                  {/* 종속항 번호 라벨을 앞으로 배치 */}
                                  <span className="px-2.5 py-0.5 bg-indigo-50 text-[10px] font-bold text-indigo-600 rounded-md border border-indigo-100">
                                    종속항 {depNumber}
                                  </span>
                                </div>
                                <div className="text-sm">
                                   {renderText(dep)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
              <p className="text-slate-400 font-bold text-sm">표시할 청구항 데이터가 없습니다.</p>
            </div>
          )}
        </div>
    
      </div>
    </div>
  );
}