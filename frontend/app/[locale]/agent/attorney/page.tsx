import React from "react";
import Header from "@/components/layouts/AgentHeader";
import {
  Building2,
  Menu,
  X,
  ChevronRight,
  Clock
} from "lucide-react";


/**
 * [변리사 페이지 - 기능 준비중]
 * 파일 경로: /app/[locale]/agent/attorney/page.tsx
 */
export default function AttorneyPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-blue-600 selection:text-white">
      {/* <Header /> */}

      <main className="max-w-5xl mx-auto py-40 px-6 text-center animate-in fade-in duration-700">
        {/* 히어로 섹션 */}
        <div className="mb-8 flex justify-center">
          <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 animate-pulse">
            <Clock size={40} />
          </div>
        </div>

        <div className="mb-10 text-center">
          <span className="text-blue-600 font-black text-sm uppercase tracking-widest mb-4 block">Coming Soon</span>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900 mb-6">
            변리사 상세 검색 서비스를<br />준비 중입니다.
          </h2>
          <p className="text-zinc-400 font-bold text-lg max-w-md mx-auto leading-relaxed text-center">
            전문 분야별 최적의 변리사를 직접 매칭해드리기 위해<br />데이터베이스 정밀 분석 작업을 진행하고 있습니다.
          </p>
        </div>

        <div className="flex justify-center gap-4">
          <a
            href="/agent/marketplace"
            className="inline-flex items-center gap-2 px-8 py-4 bg-zinc-900 text-white font-black rounded-2xl hover:bg-blue-600 transition-all shadow-lg active:scale-95"
          >
            사무소 검색 이용하기 <ChevronRight size={18} />
          </a>
        </div>
      </main>

      {/* <footer className="py-12 border-t border-zinc-100 text-center">
        <p className="text-zinc-300 text-xs font-black uppercase tracking-widest">
          © 2024 THINKCAT-ELN. All rights reserved.
        </p>
      </footer> */}
    </div>
  );
}
