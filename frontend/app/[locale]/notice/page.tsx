'use client';

import React, { useState } from "react";
import Header from "@/components/layouts/AgentHeader";
import {
  ChevronRight,
  Building2,
  Menu,
  X,
  Bell,
  Info,
  TrendingUp,
  AlertCircle
} from "lucide-react";

/**
 * [공지사항 페이지]
 * 파일 경로: /app/[locale]/agent/announcement/page.tsx
 */
const AnnouncementPage = () => {
  const notices = [
    { id: 1, title: "THINKCAT-ELN 플랫폼 정식 런칭 안내 및 이용 가이드", date: "2024-05-20", tag: "공지" },
    // { id: 2, title: "개인정보 처리방침 개정 알림 (2024년 6월 적용 예정)", date: "2024-05-15", tag: "안내" },
    // { id: 3, title: "검색 알고리즘 업데이트: 기술 분야별 가중치 적용 시스템 도입", date: "2024-05-01", tag: "업데이트" },
    // { id: 4, title: "시스템 정기 점검 안내 (5월 25일 02:00 ~ 06:00)", date: "2024-04-28", tag: "점검" },
    // { id: 5, title: "신규 파트너십 체결: 대형 특허법인 5개소 추가 입점", date: "2024-04-20", tag: "이벤트" },
    { id: 2, title: "변리사 프로필 상세 보기 기능 안내", date: "2024-04-10", tag: "안내" },
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900">
      {/* <Header /> */}

      <main className="max-w-5xl mx-auto py-20 px-6 text-left animate-in fade-in duration-500">
        {/* 상단 섹션 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6 border-b border-zinc-100 pb-10 text-left">
          <div className="text-left">
            <h2 className="text-4xl font-black tracking-tight text-zinc-900 mb-3 text-left">공지사항</h2>
            <p className="text-zinc-400 font-bold text-lg text-left">THINKCAT-ELN의 새로운 소식과 업데이트를 전해드립니다.</p>
          </div>
          {/* <div className="flex items-center gap-3 bg-zinc-100 p-1.5 rounded-2xl">
            {['전체', '공지', '업데이트', '점검'].map((cat, i) => (
              <button 
                key={cat} 
                className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${i === 0 ? 'bg-white shadow-sm text-blue-600' : 'text-zinc-400 hover:text-zinc-600'}`}
              >
                {cat}
              </button>
            ))}
          </div> */}
        </div>

        {/* 리스트 섹션 */}
        <div className="grid gap-4 text-left">
          {notices.map((n) => (
            <div key={n.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-8 bg-white border border-zinc-100 rounded-[2.5rem] hover:border-blue-200 hover:shadow-xl transition-all cursor-pointer text-left">
              <div className="flex items-center gap-6 mb-4 sm:mb-0 text-left">
                <div className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-widest ${n.tag === '공지' ? 'bg-blue-600 text-white' : n.tag === '점검' ? 'bg-red-50 text-red-600' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                  {n.tag}
                </div>
                <h4 className="text-xl font-bold text-zinc-800 group-hover:text-blue-600 transition-colors line-clamp-1 text-left">
                  {n.title}
                </h4>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-none pt-4 sm:pt-0 border-zinc-50 text-left">
                <span className="text-sm font-bold text-zinc-400 text-left">{n.date}</span>
                <div className="w-10 h-10 rounded-full bg-zinc-50 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 transition-all text-left">
                  <ChevronRight size={18} strokeWidth={3} className="text-left" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 하단 페이지네이션 */}
        {/* <div className="mt-16 flex justify-center gap-2 text-left">
          <button className="w-10 h-10 rounded-xl border border-zinc-100 flex items-center justify-center font-bold text-blue-600 bg-white shadow-sm">1</button>
          <button className="w-10 h-10 rounded-xl border border-zinc-100 flex items-center justify-center font-bold text-zinc-400 hover:bg-zinc-50 transition-colors">2</button>
          <button className="w-10 h-10 rounded-xl border border-zinc-100 flex items-center justify-center font-bold text-zinc-400 hover:bg-zinc-50 transition-colors">3</button>
        </div> */}
      </main>

      {/* <footer className="py-12 border-t border-zinc-100 text-center text-left">
        <p className="text-zinc-300 text-xs font-black uppercase tracking-widest">
          © 2024 THINKCAT-ELN. All rights reserved.
        </p>
      </footer> */}
    </div>
  );
};

export default AnnouncementPage;
