"use client";
import React from "react";

type PatentDetailInfoProps = {
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
  };
  loading?: boolean;
};

export default function PatentDetailInfo({ data, loading = false }: PatentDetailInfoProps) {
  if (loading || !data) {
    // ✅ 스켈레톤 로딩 상태
    return (
      <section className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm p-8 mt-6 animate-pulse">
        <div className="h-6 bg-zinc-200 rounded w-1/3 mb-6"></div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="h-4 bg-zinc-200 rounded w-2/3"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/2"></div>
          <div className="h-4 bg-zinc-200 rounded w-3/4"></div>
          <div className="h-4 bg-zinc-200 rounded w-1/3"></div>
        </div>

        <div className="mt-8">
          <div className="h-5 bg-zinc-200 rounded w-20 mb-3"></div>
          <div className="h-8 bg-zinc-100 rounded w-2/3 mb-4"></div>
        </div>

        <div className="h-5 bg-zinc-200 rounded w-16 mb-3"></div>
        <div className="h-28 bg-zinc-100 rounded"></div>
      </section>
    );
  }

  // ✅ 실제 데이터 표시
  return (
    <section className="max-w-5xl mx-auto bg-white border border-zinc-200 rounded-xl shadow-sm p-8 mt-6">
      <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
        상세정보
      </h1>

      {/* 기본 정보 */}
      <div className="grid md:grid-cols-2 gap-6 text-sm text-zinc-700">
        <div>
          <p className="font-medium text-zinc-900">출원번호</p>
          <p className="mt-1 text-zinc-600">{data.application_number}</p>
        </div>

        <div>
          <p className="font-medium text-zinc-900">출원일자</p>
          <p className="mt-1 text-zinc-600">{data.filing_date || "-"}</p>
        </div>

        {data.publication_number && (
          <div>
            <p className="font-medium text-zinc-900">공개번호</p>
            <p className="mt-1 text-zinc-600">{data.publication_number}</p>
          </div>
        )}

        {data.claim_count !== undefined && (
          <div>
            <p className="font-medium text-zinc-900">청구항 수</p>
            <p className="mt-1 text-zinc-600">{data.claim_count}</p>
          </div>
        )}

        {data.ipc_code && (
          <div className="md:col-span-2">
            <p className="font-medium text-zinc-900">IPC 코드</p>
            <p className="mt-1 text-zinc-600 whitespace-pre-wrap">
              {data.ipc_code}
            </p>
          </div>
        )}
      </div>

      {/* 타이틀 + 요약 */}
      <div className="mt-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2">
          <h3 className="font-semibold text-zinc-900">타이틀</h3>
          <p className="text-zinc-600 text-sm">
            {data.applicant_name ? `출원인: ${data.applicant_name}` : ""}
            {data.inventor_name ? ` / 발명자: ${data.inventor_name}` : ""}
          </p>
        </div>

        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
          <p className="text-zinc-800 font-medium">{data.title || "-"}</p>
        </div>

        <h3 className="font-semibold text-zinc-900 mt-6 mb-2">요약</h3>
        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-100">
          <p className="text-zinc-700 whitespace-pre-line leading-relaxed">
            {data.abstract || "요약 정보가 없습니다."}
          </p>
        </div>
      </div>
    </section>
  );
}
