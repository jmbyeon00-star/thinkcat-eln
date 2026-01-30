import React from "react";

type ClaimData = {
  independent_claim: string;
  dependent_claims: string[];
};

type PatentClaimProps = {
  data?: {
    application_number: string;
    filing_date?: string;
    publication_number?: string;
    ipc_code?: string;
    title?: string;
    abstract?: string;
    claim_count?: number;
    applicant_name?: string;
    inventor_name?: string;
    claim?: Record<string, ClaimData>; // 추가
  };
  loading?: boolean;
};

export default function PatentClaimInfo({ data, loading = false }: PatentClaimProps) {
  // 하이라이트 텍스트 렌더링 함수 (필요시 구현)
  const renderHighlightedText = (text: string) => {
    // 검색어 하이라이트 로직이 있다면 여기에 구현
    return <span className="text-zinc-800">{text}</span>;
  };

  // 종속항 렌더링 함수
  const renderDependentClaims = (claimKey: string) => {
    if (!data?.claim || !data.claim[claimKey]) return null;
    
    const dependentClaims = data.claim[claimKey].dependent_claims;
    
    return (
      <div className="space-y-3">
        {dependentClaims.map((depClaim, index) => (
          <div 
            key={`${claimKey}-dep-${index}`}
            className="p-4 bg-white rounded-lg border border-zinc-200 hover:border-indigo-300 transition-colors"
          >
            {renderHighlightedText(depClaim)}
          </div>
        ))}
      </div>
    );
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden animate-pulse">
            {/* Header Skeleton */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="h-6 bg-blue-400 rounded w-32 mb-2"></div>
              <div className="h-4 bg-blue-300 rounded w-48"></div>
            </div>

            {/* Content Skeleton */}
            <div className="p-8">
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-zinc-50 rounded-xl p-4">
                    <div className="h-4 bg-zinc-200 rounded w-24 mb-2"></div>
                    <div className="h-5 bg-zinc-300 rounded w-32"></div>
                  </div>
                ))}
              </div>

              <div className="space-y-6">
                <div className="h-5 bg-zinc-200 rounded w-20"></div>
                <div className="h-20 bg-zinc-100 rounded-xl"></div>
                <div className="h-5 bg-zinc-200 rounded w-16"></div>
                <div className="h-32 bg-zinc-100 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-5xl mx-auto">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              독립항 / 종속항 정보
            </h2>
            <p className="text-blue-100 text-sm">
              Patent Claims Information
            </p>
          </div>

          {/* Card Body */}
          <div className="p-8">
            {/* Claims Section */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-4 flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                독립항 / 종속항
              </h3>

              {data.claim && Object.keys(data.claim).length > 0 ? (
                <div className="space-y-6">
                  {/* 삭제된 독립항 표시 */}
                  {(() => {
                    const deletedClaims = Object.entries(data.claim)
                      .filter(([_, claim]) => 
                        claim.independent_claim && 
                        claim.independent_claim.trim().toLowerCase().includes('삭제')
                      )
                      .map(([key]) => key);

                    if (deletedClaims.length > 0) {
                      return (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                          <p className="text-sm text-red-700">
                            <span className="font-semibold">독립항 {deletedClaims.join(', ')} 청구항 삭제</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* 일반 독립항/종속항 표시 */}
                  {Object.entries(data.claim).map(([key, claim]) => {
                    if (!claim.independent_claim) return null;
                    
                    // 삭제된 독립항은 건너뛰기
                    if (claim.independent_claim.trim().toLowerCase().includes('삭제')) {
                      return null;
                    }

                    return (
                      <div 
                        key={key} 
                        className="p-6 bg-gradient-to-br from-zinc-50 to-zinc-100/50 rounded-xl border border-zinc-200"
                      >
                        {/* 독립항 */}
                        <div className="mb-4">
                          <h4 className="text-base font-semibold text-blue-600 mb-3 flex items-center gap-2">
                            <span className="flex items-center justify-center w-6 h-6 bg-blue-600 text-white rounded-full text-xs font-bold">
                              {key}
                            </span>
                            독립항 {key}
                          </h4>
                          <div className="p-4 bg-white rounded-lg border border-blue-200 shadow-sm">
                            {renderHighlightedText(`[${key}] ${claim.independent_claim}`)}
                          </div>
                        </div>

                        {/* 종속항 */}
                        {claim.dependent_claims && claim.dependent_claims.length > 0 && (
                          <div className="pl-6 border-l-2 border-indigo-200">
                            <h5 className="text-sm font-semibold text-indigo-600 mb-3 flex items-center gap-2">
                              <svg 
                                className="w-4 h-4" 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path 
                                  strokeLinecap="round" 
                                  strokeLinejoin="round" 
                                  strokeWidth={2} 
                                  d="M13 7l5 5m0 0l-5 5m5-5H6" 
                                />
                              </svg>
                              종속항 ({claim.dependent_claims.length}건)
                            </h5>
                            {renderDependentClaims(key)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-zinc-50 rounded-xl border border-zinc-200 text-center">
                  <svg 
                    className="w-12 h-12 mx-auto mb-3 text-zinc-300" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                    />
                  </svg>
                  <p className="text-zinc-500 text-sm">청구항 정보가 없습니다.</p>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 삭제된 청구항은 제외하고 표시됩니다
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}