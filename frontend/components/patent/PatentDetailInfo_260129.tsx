import React from "react";

type PatentDetailInfoProps = {
  data?: {
    reg_number: string;
    application_number: string;
    filing_date?: string;
    publication_number?: string;
    ipc_code?: string;
    title?: string;
    abstract?: string;
    claim_count?: number;
    applicant_name?: string;
    inventor_name?: string;
  };
  loading?: boolean;
};

export default function PatentDetailInfo({ data, loading = false }: PatentDetailInfoProps) {
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
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">
            특허 상세 정보
          </h1>
          <p className="text-zinc-600">
            {data.reg_number ? `등록번호: ${data.reg_number}` : `출원번호: ${data.application_number}`}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
            <h2 className="text-xl font-semibold text-white mb-2">
              기본 정보
            </h2>
            <p className="text-blue-100 text-sm">
              Patent Basic Information
            </p>
          </div>

          {/* Basic Info Grid */}
          <div className="grid md:grid-cols-2 gap-6 px-8 py-6 bg-zinc-50 border-b border-zinc-100">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">출원번호</span>
              </div>
              <div className="text-lg font-semibold text-zinc-900">
                {data.application_number}
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                <span className="text-sm font-medium text-zinc-700">출원일자</span>
              </div>
              <div className="text-lg font-semibold text-zinc-900">
                {data.filing_date || "-"}
              </div>
            </div>

            {data.publication_number && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-cyan-500 rounded-full" />
                  <span className="text-sm font-medium text-zinc-700">공개번호</span>
                </div>
                <div className="text-lg font-semibold text-zinc-900">
                  {data.publication_number}
                </div>
              </div>
            )}

            {data.claim_count !== undefined && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-purple-500 rounded-full" />
                  <span className="text-sm font-medium text-zinc-700">청구항 수</span>
                </div>
                <div className={`text-lg font-semibold ${data.claim_count ? "text-zinc-900" : "text-zinc-400"}`}>
                  {data.claim_count ? `${data.claim_count}개` : "정보 없음"}
                </div>
              </div>
            )}

            {data.ipc_code && (
              <div className="md:col-span-2 bg-white rounded-xl p-4 shadow-sm border border-zinc-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full" />
                  <span className="text-sm font-medium text-zinc-700">IPC 코드</span>
                </div>
                <div className="text-sm font-mono text-zinc-900 whitespace-pre-wrap">
                  {data.ipc_code}
                </div>
              </div>
            )}
          </div>

          {/* Title & Abstract Section */}
          <div className="p-8">
            {/* Applicant & Inventor Info */}
            {(data.applicant_name || data.inventor_name) && (
              <div className="flex flex-wrap gap-3 mb-6">
                {data.applicant_name && (
                  <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm border border-blue-100">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                    <span className="font-medium">출원인:</span>
                    <span>{data.applicant_name}</span>
                  </div>
                )}
                {data.inventor_name && (
                  <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 px-4 py-2 rounded-lg text-sm border border-purple-100">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">발명자:</span>
                    <span>{data.inventor_name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                발명의 명칭
              </h3>
              <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                <p className="text-zinc-900 font-medium leading-relaxed">
                  {data.title || "-"}
                </p>
              </div>
            </div>

            {/* Abstract */}
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <div className="w-1 h-5 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                요약
              </h3>
              <div className="p-5 bg-zinc-50 rounded-xl border border-zinc-100">
                <p className="text-zinc-700 whitespace-pre-line leading-relaxed">
                  {data.abstract || "요약 정보가 없습니다."}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-4 bg-zinc-50 border-t border-zinc-100">
            <p className="text-xs text-zinc-500">
              💡 특허 정보는 출원 시점 기준으로 표시됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}