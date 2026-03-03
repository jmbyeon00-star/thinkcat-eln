"use client";
import React from "react";
import { 
  Hash, 
  Calendar, 
  BookOpen, 
  ClipboardList,
  Info,
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
  };
  loading?: boolean;
};

export default function PatentDetailInfo({ data, loading = false }: PatentDetailInfoProps) {
  
  if (loading || !data) {
    return <div className="w-full h-40 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;
  }

  return (
    <div className="w-full text-left font-sans">
      {/* 🏷️ 상단 제목 영역 - 큰 아이콘 적용 */}
      <div className="mb-8 flex items-start gap-4">
        <ClipboardList className="text-indigo-600 shrink-0 mt-1" size={56} /> 

        <div className="flex flex-col">
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
            특허 상세 정보
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
            COMPREHENSIVE PATENT SPECIFICATION
          </p>
        </div>
      </div>

      {/* 🗺️ 메인 카드 컨테이너 */}
      <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
        
        {/* [수정] 네이비 헤더 - '기본 정보' 폰트 크기를 독립항 섹션과 동일하게 text-2xl로 확대 */}
        <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-black text-white tracking-tighter">
                기본 정보
              </h2>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                PATENT METADATA
              </p>
            </div>
          </div>
        </div>

        {/* [2] 상단 주요 정보 타일 (출원번호, 등록번호, 출원일자) */}
        <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100">
          <StatTile 
            label="출원번호" 
            value={data.application_number} 
            icon={<Hash size={16} className="text-indigo-500" />} 
          />
          <StatTile 
            label="등록번호" 
            value={data.reg_number || "미등록"} 
            icon={<CheckCircle2 size={16} className="text-emerald-500" />} 
          />
          <StatTile 
            label="출원일자" 
            value={data.filing_date || "-"} 
            icon={<Calendar size={16} className="text-blue-500" />} 
          />
        </div>

        {/* [3] 상세 내용 섹션 (IPC코드, 명칭, 요약 디자인 통일) */}
        <div className="p-8 space-y-8">
          
          {/* IPC 코드 */}
          <div className="space-y-3">
            <SectionTitle title="IPC 코드" />
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 flex items-center gap-3">
              <code className="text-slate-700 font-mono text-sm tracking-wider font-bold">
                {data.ipc_code || "정보 없음"}
              </code>
            </div>
          </div>

          {/* 발명의 명칭 */}
          <div className="space-y-3">
            <SectionTitle title="발명의 명칭" />
            <div className="bg-indigo-50/30 rounded-2xl p-6 border border-indigo-100/50">
              <p className="text-lg font-bold text-slate-800 leading-snug">
                {data.title || "-"}
              </p>
            </div>
          </div>

          {/* 요약 */}
          <div className="space-y-3">
            <SectionTitle title="요약" />
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-line">
                {data.abstract || "요약 정보가 없습니다."}
              </p>
            </div>
          </div>
        </div>

    
      </div>
    </div>
  );
}

// --- [하위 컴포넌트] ---

function StatTile({ label, value, icon }: { label: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white px-8 py-6 border-r last:border-r-0 border-slate-100 flex flex-col gap-2 group hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-50 rounded-lg group-hover:bg-white transition-colors">
          {icon}
        </div>
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-black text-slate-900 truncate">
        {value}
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