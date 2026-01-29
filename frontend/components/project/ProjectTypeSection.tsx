// frontend/components/project/ProjectTypeSection.tsx

import React, { useEffect, useState } from "react";
import { Database, Plus } from "lucide-react";
import { ProjectInfo } from "@/types/project";

interface ProjectTypeSectionProps {
    projectInfo: ProjectInfo | null | undefined;
}

export default function ProjectTypeSection({ projectInfo }: ProjectTypeSectionProps) {
    // Hydration 에러 방지: 클라이언트 마운트 여부 확인
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted || !projectInfo) return null;

    const isSearch = projectInfo.source_type === 'search';

    return (
        <section className={`relative overflow-hidden rounded-2xl border transition-all p-5 mb-6
      ${isSearch ? 'bg-blue-50/50 border-blue-100' : 'bg-emerald-50/50 border-emerald-100'}`}>

            {/* 배경 장식 (패턴) */}
            <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
                {isSearch
                    ? <Database size={120} className="text-blue-600" />
                    : <Plus size={120} className="text-emerald-600" />
                }
            </div>

            <div className="flex items-center gap-5 relative z-10">
                {/* 아이콘 박스 */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm shrink-0
          ${isSearch ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                    {isSearch
                        ? <Database className="text-white w-7 h-7" />
                        : <Plus className="text-white w-7 h-7" />
                    }
                </div>

                {/* 텍스트 설명 */}
                <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md
              ${isSearch ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {projectInfo.source_type}
                        </span>
                        <h2 className="text-lg font-bold text-zinc-900 truncate">
                            {isSearch ? "데이터베이스 검색 기반" : "파일 업로드 기반"}
                        </h2>
                    </div>
                    <p className="text-sm text-zinc-600 line-clamp-1 md:line-clamp-none">
                        {isSearch
                            ? "글로벌 특허 및 논문 데이터베이스를 직접 조회하여 구성된 프로젝트입니다."
                            : "사용자가 직접 업로드한 로컬 문서 파일을 기반으로 구성된 프로젝트입니다."}
                    </p>
                </div>

                {/* 상태 표시 뱃지 */}
                <div className="hidden md:block text-right shrink-0">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Active Status</p>
                    <div className="flex items-center gap-1.5 justify-end">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-semibold text-zinc-700 font-mono">LIVE_STREAMING</span>
                    </div>
                </div>
            </div>
        </section>
    );
}