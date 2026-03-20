"use client";
import React from "react";
import {
  FileText,
  Calendar,
  Hash,
  Users,
  Globe,
  Info,
  Layers,
  User,
  Activity,
  CheckCircle2
} from "lucide-react";

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
    end_status?: string;
  };
  loading?: boolean;
};

export default function PatentDetailInfo({ data, loading = false }: PatentDetailInfoProps) {
  // --- [1] 로딩 상태 (Skeleton) ---
  if (loading || !data) {
    return (
      <div className="w-full animate-pulse space-y-8">
        <div className="space-y-3">
          <div className="h-10 bg-slate-100 rounded-2xl w-1/3" />
          <div className="h-4 bg-slate-50 rounded-xl w-1/4" />
        </div>
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-20 bg-slate-900" />
          <div className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-slate-50 rounded-[1.5rem]" />
              ))}
            </div>
            <div className="h-40 bg-slate-50 rounded-[1.5rem]" />
          </div>
        </div>
      </div>
    );
  }

  // --- [2] 데이터 표시 상태 ---
  return (
    <div className="w-full text-left">
      {/* Header */}
      <div className="mb-10 space-y-2">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
          특허 상세 정보
        </h1>
        <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
          <Hash size={14} />
          {data.reg_number ? `등록번호: ${data.reg_number}` : `출원번호: ${data.application_number}`}
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">

        {/* Card Header (Slate Dark Theme) */}
        <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Info size={20} className="text-indigo-400" /> 기본 정보
            </h2>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">
              Patent Basic Information
            </p>
          </div>
          {data.end_status && (
            <span className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[11px] font-black uppercase tracking-widest">
              {data.end_status}
            </span>
          )}
        </div>

        {/* Basic Info Grid */}
        <div className="grid md:grid-cols-2 gap-4 p-8 bg-zinc-50/50">

          <InfoItem
            icon={<Hash className="text-blue-500" />}
            label="출원번호"
            value={data.application_number}
          />
          <InfoItem
            icon={<Calendar className="text-indigo-500" />}
            label="출원일자"
            value={data.filing_date || "-"}
          />

          <InfoItem
            icon={<CheckCircle2 className="text-teal-500" />}
            label="등록번호"
            value={data.reg_number || "-"}
          />

          {data.publication_number && (
            <InfoItem
              icon={<Activity className="text-cyan-500" />}
              label="공개번호"
              value={data.publication_number}
            />
          )}

          <InfoItem
            icon={<Layers className="text-purple-500" />}
            label="청구항 수"
            value={data.claim_count ? `${data.claim_count}개` : "정보 없음"}
            isDimmed={!data.claim_count}
          />

          {data.ipc_code && (
            <div className="md:col-span-2 bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                <Globe size={16} className="text-emerald-500" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">IPC 코드</span>
              </div>
              <div className="text-xs font-mono text-slate-900 leading-relaxed break-all bg-slate-50 p-3 rounded-xl">
                {data.ipc_code}
              </div>
            </div>
          )}
        </div>

        {/* Title & Abstract Section */}
        <div className="p-10 space-y-10">

          {/* 인적 사항 뱃지 */}
          <div className="flex flex-wrap gap-3">
            {data.applicant_name && (
              <PersonBadge icon={<Users size={14} />} label="출원인" name={data.applicant_name} color="blue" />
            )}
            {data.inventor_name && (
              <PersonBadge icon={<User size={14} />} label="발명자" name={data.inventor_name} color="purple" />
            )}
          </div>

          {/* 특허명 */}
          <div className="space-y-4">
            <SectionTitle title="특허명 (Title)" />
            <div className="p-6 bg-gradient-to-br from-indigo-50/50 to-blue-50/50 rounded-[2rem] border border-indigo-100">
              <p className="text-slate-900 font-black text-lg leading-tight">
                {data.title || "-"}
              </p>
            </div>
          </div>

          {/* 요약 */}
          <div className="space-y-4">
            <SectionTitle title="요약 (Abstract)" />
            <div className="p-8 bg-white rounded-[2rem] border border-slate-100 shadow-inner-sm">
              <p className="text-slate-600 font-medium text-[15px] leading-relaxed whitespace-pre-line">
                {data.abstract || "요약 정보가 등록되지 않았습니다."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            {/* <CheckCircle2 size={12} />  */}
            💡 특허 정보는 출원 시점 기준으로 표시됩니다.
          </p>
          <p className="text-[10px] font-black text-slate-300 italic">
            Snapshot: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}

// --- [컴포넌트 내 재사용 가능한 작은 부품들] ---

function InfoItem({ icon, label, value, isDimmed = false }: any) {
  return (
    <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-slate-100 transition-all hover:border-indigo-200">
      <div className="flex items-center gap-2 mb-2">
        {React.cloneElement(icon, { size: 14 })}
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
      <div className={`text-lg font-black tracking-tight ${isDimmed ? "text-slate-300" : "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    // <h3 className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-2">
    // <div className="w-1 h-3 bg-indigo-600 rounded-full" />
    <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-400">
      <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
      {title}
    </h3>
  );
}

function PersonBadge({ icon, label, name, color }: any) {
  const colorClass = color === "blue" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-purple-50 text-purple-700 border-purple-100";
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black border ${colorClass}`}>
      {icon}
      <span>{label}: {name}</span>
    </div>
  );
}