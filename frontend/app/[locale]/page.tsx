'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslations } from 'next-intl';
import { Link } from '@/routing';
import {
  Search,
  Globe,
  Utensils,
  Truck,
  Beaker,
  Scissors,
  Home as HomeIcon,
  Wrench,
  Lightbulb,
  Zap,
  Building2,
  ChevronDown,
  Hash,
  Check,
  ArrowRight
} from "lucide-react";

/**
 * [CPC 8개 섹션 분류 데이터]
 */
const CPC_SECTORS = [
  { id: "all", name: "전체", icon: <Globe className="w-6 h-6" /> },
  { id: "A", name: "인간생활", icon: <Utensils className="w-6 h-6" /> },
  { id: "B", name: "처리/운송", icon: <Truck className="w-6 h-6" /> },
  { id: "C", name: "화학/야금", icon: <Beaker className="w-6 h-6" /> },
  { id: "D", name: "섬유/제지", icon: <Scissors className="w-6 h-6" /> },
  { id: "E", name: "고정구조물", icon: <HomeIcon className="w-6 h-6" /> },
  { id: "F", name: "기계/조명", icon: <Wrench className="w-6 h-6" /> },
  { id: "G", name: "물리학", icon: <Lightbulb className="w-6 h-6" /> },
  { id: "H", name: "전기", icon: <Zap className="w-6 h-6" /> },
];

export default function Home() {
  const t = useTranslations('home');

  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("firm");
  const [searchCategory, setSearchCategory] = useState("A");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsTypeOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setIsCategoryOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const executeSearch = (q: string, type: string, cat: string) => {
    // /agent/marketplace 페이지로 이동하면서 검색 파라미터 전달
    if (typeof window !== "undefined") {
      const params = new URLSearchParams();
      params.set('q', q);
      params.set('type', type);
      if (type === 'keyword') params.set('cat', cat);
      window.location.href = `/agent/marketplace?${params.toString()}`;
    }
  };

  const currentCategory = useMemo(() => CPC_SECTORS.find(s => s.id === searchCategory) || CPC_SECTORS[1], [searchCategory]);

  return (
    <main id="main-snap-container" className="bg-white selection:bg-blue-100">
      <style jsx global>{`
                #main-snap-container {
                    height: 100vh;
                    overflow-y: auto;
                    scroll-behavior: smooth;
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                #main-snap-container::-webkit-scrollbar {
                    display: none;
                }
                section {
                    min-height: 100vh;
                    width: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    position: relative;
                }
            `}</style>

      {/* SECTION 1: Hero & Search */}
      <section className="px-6 text-center">
        {/* Background Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none opacity-40">
          <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-blue-50 rounded-full blur-[120px]" />
          <div className="absolute bottom-[10%] left-[10%] w-72 h-72 bg-zinc-50 rounded-full blur-[100px]" />
        </div>

        <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-zinc-900 leading-none">
            THINKCAT-ELN<span className="text-red-600">.</span>
          </h1>

          <p className="max-w-xl mx-auto text-lg md:text-xl text-zinc-400 font-medium leading-relaxed">
            전문 분야별 최적의 파트너를 확인하세요
          </p>

          {/* Agent Search Section */}
          <div className="max-w-3xl mx-auto mt-8">
            <div className="relative flex items-center bg-white border-2 border-slate-100 rounded-[2.5rem] focus-within:ring-8 focus-within:ring-blue-500/5 focus-within:border-blue-600 transition-all shadow-2xl shadow-slate-200/40 h-16 md:h-20">
              <div className="relative h-full shrink-0" ref={dropdownRef}>
                <button onClick={() => setIsTypeOpen(!isTypeOpen)} className={`flex items-center gap-2 px-6 h-full font-black text-slate-700 hover:bg-slate-50 border-r-2 border-slate-100 rounded-l-[2.5rem] ${isTypeOpen ? 'bg-slate-50' : ''}`}>
                  <div className="text-blue-600">{searchType === 'firm' ? <Building2 size={20} /> : <Hash size={20} />}</div>
                  <span className="hidden sm:inline text-sm font-black">{searchType === 'firm' ? '사무소' : '특허기반'}</span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} />
                </button>
                {isTypeOpen && (
                  <div className="absolute top-[110%] left-0 w-48 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2 px-1.5 z-[110]">
                    <button onClick={() => { setSearchType('firm'); setSearchQuery(""); setIsTypeOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${searchType === 'firm' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                      <div className="flex items-center gap-2"><Building2 size={16} /><span className="font-bold text-xs">사무소 검색</span></div>
                      {searchType === 'firm' && <Check size={14} className="text-blue-600" />}
                    </button>
                    <button onClick={() => { setSearchType('keyword'); setSearchQuery(""); setIsTypeOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${searchType === 'keyword' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}>
                      <div className="flex items-center gap-2"><Hash size={16} /><span className="font-bold text-xs">특허기반 검색</span></div>
                      {searchType === 'keyword' && <Check size={14} className="text-blue-600" />}
                    </button>
                  </div>
                )}
              </div>
              {searchType === 'keyword' && (
                <div className="relative h-full shrink-0" ref={categoryRef}>
                  <button onClick={() => setIsCategoryOpen(!isCategoryOpen)} className="flex items-center gap-2 px-5 h-full font-black text-blue-600 hover:bg-blue-50 transition-all border-r-2 border-slate-100">
                    <div className="bg-blue-100 p-1.5 rounded-lg">{currentCategory.icon}</div>
                    <span className="hidden lg:inline text-sm font-black uppercase tracking-widest">{currentCategory.id}</span>
                    <ChevronDown size={14} className="text-blue-400" />
                  </button>
                  {isCategoryOpen && (
                    <div className="absolute top-[110%] left-0 w-[320px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-5 z-[110]">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2">검색 분야</p>
                      <div className="grid grid-cols-2 gap-2">
                        {CPC_SECTORS.filter(s => s.id !== 'all').map((sector) => (
                          <button key={sector.id} onClick={() => { setSearchCategory(sector.id); setIsCategoryOpen(false); }} className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${searchCategory === sector.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}>
                            <div className={searchCategory === sector.id ? 'text-white' : 'text-blue-600'}>{sector.icon}</div>
                            <span className="font-bold text-xs">{sector.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 relative h-full flex items-center">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none"><Search size={20} strokeWidth={3} /></div>
                <input
                  type="text"
                  placeholder={searchType === "firm" ? "사무소명 또는 변리사 입력 후 엔터" : "기술 키워드(예: 항암제) 입력 후 엔터"}
                  className="w-full h-full bg-transparent pl-14 pr-8 outline-none text-base font-medium text-slate-800 placeholder:text-slate-300 placeholder:text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchQuery.trim() && executeSearch(searchQuery.trim(), searchType, searchCategory)}
                />
                <button
                  onClick={() => searchQuery.trim() && executeSearch(searchQuery.trim(), searchType, searchCategory)}
                  className="mr-3 px-6 h-10 md:h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-black text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 group shrink-0"
                >
                  <Search size={18} strokeWidth={3} className="group-hover:scale-110 transition-transform" />
                  <span className="hidden sm:inline">검색</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-8">
            <Link href="/search"
              className="px-10 py-5 border-2 border-blue-600 text-blue-600 rounded-2xl font-black transition-all hover:bg-blue-600 hover:text-white hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              특허 찾기<ArrowRight size={20} />
            </Link>
            <Link href="/announcement"
              className="px-10 py-5 bg-zinc-900 text-white rounded-2xl font-black shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              R&D 공고<ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
