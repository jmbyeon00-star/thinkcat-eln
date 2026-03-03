'use client';

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Globe,
  MapPin,
  FileText,
  ChevronRight,
  TrendingUp,
  X,
  Utensils,
  Truck,
  Beaker,
  Scissors,
  Home as HomeIcon,
  Wrench,
  Lightbulb,
  Zap,
  Phone,
  Users,
  Building2,
  ChevronDown,
  Info,
  Compass,
  LocateFixed,
  Hash,
  Check,
  Plus,
  ExternalLink,
  ChevronLeft,
  ArrowRight,
  Calendar,
  Layers,
  Bookmark,
  GanttChartSquare,
  PhoneCall,
  Link as LinkIcon
} from "lucide-react";


import Header from '@/components/layouts/AgentHeader';
import { getAgentSorting, searchAgentCompany, searchAgentKeyword } from "@/lib/api";
import { getLogoManifest, findLogoInManifest } from "@/lib/logo-utils";

// 2. API 타입 정의
interface ApiResponse {
  id: number;
  company_ko: string;
  address: string;
  postal_code: string;
  agent_code: string;
  establish_year: string;
  name: string;
  homepage: string;
  phone_number: string;
  fax: string;
  star_check: number;
  A_patent: number; B_patent: number; C_patent: number; D_patent: number;
  E_patent: number; F_patent: number; G_patent: number; H_patent: number;
}

interface PatentEntry {
  app_number: string;
  title: string;
  distance: number;
}

interface Firm {
  id: number | string;
  company_ko: string;
  address: string;
  patentCount: number;
  isVerified: boolean;
  agent_code: string;
  establish_year: string;
  representatives: string;
  homepage?: string;
  phone?: string;
  rating: number;
  agentCount?: number;
  matchingPatents?: PatentEntry[];
  topScore?: number;
  fax?: string;
}



/**
 * [CompanyLogo Component - 배경 대비 및 그림자 개선 버전]
 */
function CompanyLogo({ companyName, className = "" }: { companyName: string; className?: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const findLogo = async () => {
      if (!companyName) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const manifest = await getLogoManifest();
        const extensions = ['png', 'svg', 'jpg', 'jpeg', 'gif', 'avif'];
        const logoPath = findLogoInManifest(companyName, extensions, manifest);
        setLogoUrl(logoPath);
      } catch (err) {
        console.error("Logo lookup error:", err);
        setLogoUrl(null);
      } finally {
        setLoading(false);
      }
    };

    findLogo();
  }, [companyName]);

  const firstLetter = companyName.charAt(0);

  if (!loading && !logoUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-50 border border-slate-100 ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-2">
          <Building2 className="w-6 h-6 text-blue-400" />
        </div>
        <span className="text-slate-300 font-black text-4xl select-none">
          {firstLetter}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center overflow-hidden bg-white ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50 animate-pulse">
          <Building2 className="w-8 h-8 text-slate-200" />
        </div>
      )}
      {logoUrl && (
        <img
          src={logoUrl}
          alt={`${companyName} 로고`}
          className="w-full h-full object-contain p-6 md:p-8 transition-all duration-500 transform drop-shadow-md opacity-100 scale-100"
        />
      )}
    </div>
  );
}

/**
 * [AttorneyPhoto Component]
 */
function AttorneyPhoto({ agentCode, name, className = "" }: { agentCode: string; name: string; className?: string }) {
  const [error, setError] = useState(false);
  const photoPath = `/attorney_photos/${agentCode}_${name}.jpg`;

  if (error || !agentCode || !name) {
    return (
      <div className={`bg-slate-100 flex items-center justify-center overflow-hidden ${className}`}>
        <Users className="text-slate-300 w-1/2 h-1/2" />
      </div>
    );
  }

  return (
    <img
      src={photoPath}
      alt={name}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  );
}


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




/**
 * [Marketplace Page Component]
 * 파일 경로: /app/[locale]/agent/marketplace/page.tsx
 */
export default function MarketplacePage() {
  const [view, setView] = useState<'main' | 'search'>('main');
  const [selectedSector, setSelectedSector] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("firm");
  const [searchCategory, setSearchCategory] = useState("A");
  const [activeSearchType, setActiveSearchType] = useState("firm");
  const [activeSearchCategory, setActiveSearchCategory] = useState("A");
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const [firms, setFirms] = useState<Firm[]>([]);
  const [totalFirms, setTotalFirms] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState("nearest");
  const [searchResults, setSearchResults] = useState<Firm[]>([]);
  const [searchRefinedKey, setSearchRefinedKey] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ city?: string, gu?: string, dong?: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const handleGetLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setSortBy("recommend");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`);
          const data = await res.json();
          const addr = data.address;
          setUserLocation({
            city: addr.city || addr.province || addr.state,
            gu: addr.borough || addr.district || addr.city_district,
            dong: addr.suburb || addr.neighbourhood
          });
          setSortBy("nearest");
        } catch (err) { setSortBy("recommend"); } finally { setLocating(false); }
      },
      () => { setSortBy("recommend"); setLocating(false); },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  /**
   * [수정] 컴포넌트 마운트 시 URL 파라미터를 읽어 검색 상태 복구
   */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get('q');
      const type = params.get('type') || 'firm';
      const cat = params.get('cat') || 'A';

      if (q) {
        // URL에 검색어가 있으면 해당 조건으로 검색 실행
        setSearchQuery(q);
        setSearchType(type);
        setSearchCategory(cat);
        executeSearch(q, type, cat);
      } else {
        // 검색어가 없을 때만 위치 정보를 가져옴
        handleGetLocation();
      }
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setIsTypeOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) setIsCategoryOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (view === 'main') { setPage(1); loadMainFirms(true, 1); }
  }, [selectedSector, sortBy, view, userLocation]);

  const loadMainFirms = async (isReset: boolean, p: number) => {
    try {
      setLoading(true);
      const params: any = { page: p, page_size: 10, sort: sortBy, city: userLocation?.city, gu: userLocation?.gu, dong: userLocation?.dong };
      console.log('[loadMainFirms] Calling API with:', { sector: selectedSector, params });
      const response: any = await getAgentSorting(selectedSector.toLowerCase(), params);
      console.log('[loadMainFirms] API Response:', response);
      const mapped: Firm[] = (response.items || []).map((item: any) => {
        const totalCount = ((item.A_patent || 0) + (item.B_patent || 0) + (item.C_patent || 0) + (item.D_patent || 0) + (item.E_patent || 0) + (item.F_patent || 0) + (item.G_patent || 0) + (item.H_patent || 0));
        const displayCount = selectedSector === "all" ? totalCount : (item[`${selectedSector.toUpperCase()}_patent`] || 0);
        return { id: item.id, company_ko: item.company_ko, address: item.address, patentCount: displayCount, agent_code: item.agent_code, establish_year: item.establish_year, representatives: item.name, isVerified: true, rating: 4.8 };
      });
      console.log('[loadMainFirms] Mapped firms:', mapped.length);
      if (isReset) setFirms(mapped); else setFirms(prev => [...prev, ...mapped]);
      setTotalFirms(response.total);
    } catch (err) { console.error('[loadMainFirms] Error:', err); } finally { setLoading(false); }
  };

  const handleFirmClick = (name: string) => {
    window.location.href = `/agent/${encodeURIComponent(name.trim())}`;
  };

  /**
   * [특허 상세 클릭 시 처리 로직]
   */
  const handlePatentClick = (appNumber: string) => {
    window.location.href = `/search/applicationNum/${encodeURIComponent(appNumber)}`;
  };

  const executeSearch = async (q: string, type: string, cat: string) => {
    setActiveSearchType(type);
    setActiveSearchCategory(cat);
    setView('search');
    setSearchLoading(true);

    // URL 동기화 (히스토리 관리를 위해 pushState 또는 replaceState 사용)
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set('q', q);
      url.searchParams.set('type', type);
      if (type === 'keyword') url.searchParams.set('cat', cat);
      else url.searchParams.delete('cat');
      window.history.replaceState({}, '', url.toString());
    }

    try {
      if (type === 'keyword') {
        const response: any = await searchAgentKeyword(q, cat, 60);
        setSearchRefinedKey(response.keyword || q);
        const mapped: Firm[] = (response.items || []).map((item: any, idx: number) => ({
          id: `kw-${idx}`, company_ko: item.company_ko, address: item.address, agentCount: item.agent_count, phone: item.phone_number, homepage: item.homepage, patentCount: item.patent_count, matchingPatents: item.patents, topScore: item.patents?.[0] ? Math.max(0, (1 - item.patents[0].distance) * 100) : 0, isVerified: true, rating: 4.9, agent_code: "", establish_year: "정보없음", representatives: "전문 변리사 그룹"
        }));
        setSearchResults(mapped);
      } else {
        const response: any = await searchAgentCompany(q);
        setSearchRefinedKey(response.refined_keyword || q);
        const mappedResults: Firm[] = (response.items || []).map((item: any) => {
          const totalCount = ((item.A_patent || 0) + (item.B_patent || 0) + (item.C_patent || 0) + (item.D_patent || 0) + (item.E_patent || 0) + (item.F_patent || 0) + (item.G_patent || 0) + (item.H_patent || 0));
          return { id: item.id, company_ko: item.company_ko, address: item.address, patentCount: totalCount, agent_code: item.agent_code, establish_year: item.establish_year, representatives: item.name, isVerified: true, rating: 4.8 };
        });
        setSearchResults(mappedResults);
      }
    } catch (err) { setSearchResults([]); } finally { setSearchLoading(false); }
  };

  const handleReset = () => {
    // 메인으로 돌아갈 때 URL 파라미터 제거
    if (typeof window !== "undefined") {
      window.history.replaceState({}, '', window.location.pathname);
    }
    setView('main'); setSelectedSector("all"); setSearchQuery(""); setSearchResults([]); setSearchType("firm"); setSearchCategory("A"); setActiveSearchType("firm"); if (!userLocation) handleGetLocation(); setSortBy("nearest");
  };

  const currentCategory = useMemo(() => CPC_SECTORS.find(s => s.id === searchCategory) || CPC_SECTORS[1], [searchCategory]);
  const displayTitle = useMemo(() => selectedSector === "all" ? "종합 추천 순위" : `${selectedSector} 섹션 추천 사무소`, [selectedSector]);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 pb-20 text-left">
      {/* <Header onHome={handleReset} /> */}
      <style>{`.text-left { text-align: left !important; }`}</style>

      <div className="max-w-4xl mx-auto px-4 pt-16 pb-8 text-left">
        <div className="mb-12 text-left">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight text-center">
            전문 분야별 <span className="text-blue-600">최적의 파트너</span>를<br className="hidden md:block" /> 확인하세요
          </h2>
          <p className="text-slate-400 font-bold text-lg text-center">1,600개 이상의 사무소 실적데이터를 집계하여 보여드립니다.</p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="relative flex items-center bg-white border-2 border-slate-100 rounded-[2.5rem] focus-within:ring-8 focus-within:ring-blue-500/5 focus-within:border-blue-600 transition-all shadow-2xl shadow-slate-200/40 h-16 md:h-20 text-left">
            <div className="relative h-full shrink-0" ref={dropdownRef}>
              <button onClick={() => setIsTypeOpen(!isTypeOpen)} className={`flex items-center gap-2 px-6 h-full font-black text-slate-700 hover:bg-slate-50 border-r-2 border-slate-100 rounded-l-[2.5rem] ${isTypeOpen ? 'bg-slate-50' : ''}`}><div className="text-blue-600">{searchType === 'firm' ? <Building2 size={20} /> : <Hash size={20} />}</div><span className="hidden sm:inline text-sm font-black">{searchType === 'firm' ? '사무소' : '특허기반'}</span><ChevronDown size={14} className={`text-slate-400 transition-transform ${isTypeOpen ? 'rotate-180' : ''}`} /></button>
              {isTypeOpen && (
                <div className="absolute top-[110%] left-0 w-48 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2 px-1.5 z-[110] animate-in fade-in zoom-in-95 text-left">
                  <button onClick={() => { setSearchType('firm'); setSearchQuery(""); setIsTypeOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${searchType === 'firm' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}><div className="flex items-center gap-2"><Building2 size={16} /><span className="font-bold text-xs">사무소 검색</span></div>{searchType === 'firm' && <Check size={14} className="text-blue-600" />}</button>
                  <button onClick={() => { setSearchType('keyword'); setSearchQuery(""); setIsTypeOpen(false); }} className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all ${searchType === 'keyword' ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-600'}`}><div className="flex items-center gap-2"><Hash size={16} /><span className="font-bold text-xs">특허기반 검색</span></div>{searchType === 'keyword' && <Check size={14} className="text-blue-600" />}</button>
                </div>
              )}
            </div>
            {searchType === 'keyword' && (
              <div className="relative h-full shrink-0" ref={categoryRef}>
                <button onClick={() => setIsCategoryOpen(!isCategoryOpen)} className="flex items-center gap-2 px-5 h-full font-black text-blue-600 hover:bg-blue-50 transition-all border-r-2 border-slate-100"><div className="bg-blue-100 p-1.5 rounded-lg">{currentCategory.icon}</div><span className="hidden lg:inline text-sm font-black uppercase tracking-widest">{currentCategory.id}</span><ChevronDown size={14} className="text-blue-400" /></button>
                {isCategoryOpen && (
                  <div className="absolute top-[110%] left-0 w-[320px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-5 z-[110] animate-in fade-in zoom-in-95 text-left text-left text-left text-left">
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 px-2 text-left text-left">검색 분야</p>
                    <div className="grid grid-cols-2 gap-2 text-left">
                      {CPC_SECTORS.filter(s => s.id !== 'all').map((sector) => (
                        <button key={sector.id} onClick={() => { setSearchCategory(sector.id); setIsCategoryOpen(false); }} className={`flex items-center gap-3 p-3 rounded-2xl transition-all border ${searchCategory === sector.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100'}`}><div className={searchCategory === sector.id ? 'text-white' : 'text-blue-600'}>{sector.icon}</div><span className="font-bold text-xs">{sector.name}</span></button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 relative h-full flex items-center">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none text-left"><Search size={20} strokeWidth={3} /></div>
              <input
                type="text"
                placeholder={searchType === "firm" ? "사무소명 또는 변리사 입력 후 엔터" : "기술 키워드(예: 항암제) 입력 후 엔터"}
                className="w-full h-full bg-transparent pl-14 pr-8 outline-none text-base font-medium text-slate-800 placeholder:text-slate-300 placeholder:text-sm text-left"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchQuery.trim(), searchType, searchCategory)}
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
      </div>

      {view === 'main' ? (
        <>
          <div className="px-4 py-8 overflow-x-auto no-scrollbar flex gap-5 max-w-4xl mx-auto scroll-smooth text-left text-left text-left text-left">
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            {CPC_SECTORS.map((sector) => (
              <button key={sector.id} onClick={() => setSelectedSector(sector.id)} className={`flex flex-col items-center gap-3 shrink-0 transition-all ${selectedSector === sector.id ? "scale-105" : "opacity-40 hover:opacity-100"}`}><div className={`p-6 rounded-[2.2rem] transition-all duration-500 ${selectedSector === sector.id ? "bg-blue-600 text-white shadow-2xl shadow-blue-200 -translate-y-2" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{sector.icon}</div><span className={`text-[13px] font-black tracking-tight ${selectedSector === sector.id ? "text-blue-600" : "text-slate-500"}`}>{sector.name}</span></button>
            ))}
          </div>

          <main className="max-w-4xl mx-auto px-4 mt-8 text-left text-left">
            <div className="flex items-center justify-between mb-8 text-left text-left text-left text-left">
              <div className="flex items-center gap-3 text-left text-left text-left"><TrendingUp className="text-blue-600 w-5 h-5 text-left text-left text-left text-left" /><h2 className="text-2xl font-black text-slate-900 tracking-tight text-left text-left text-left text-left">{displayTitle}</h2></div>
              <div className="flex items-center gap-2 text-left text-left">
                <div className="relative text-left text-left text-left text-left text-left"><select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="appearance-none pl-4 pr-10 py-2.5 rounded-xl font-bold text-sm cursor-pointer bg-slate-50 text-zinc-600 outline-none"><option value="recommend">추천순</option><option value="nearest">가까운순</option><option value="oldest">업력순</option></select><ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-none" /></div>
                <button onClick={handleGetLocation} className={`p-2.5 rounded-xl border transition-all ${userLocation ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white border-zinc-200 text-zinc-400 hover:bg-slate-50'}`}><LocateFixed size={18} className={locating ? 'animate-spin' : ''} /></button>
              </div>
            </div>

            {userLocation && sortBy === 'nearest' && (
              <div className="mb-10 bg-blue-50 text-blue-700 px-6 py-4 rounded-[2rem] text-sm font-bold border border-blue-100 flex items-center justify-between animate-in slide-in-from-top-2 text-left text-left">
                <div className="flex items-center gap-3 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><Compass size={18} className="text-blue-600 text-left text-left text-left text-left" /><span className="text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">'{userLocation.city} {userLocation.gu || ""} {userLocation.dong || ""}' 주변 사무소 우선 노출 중</span></div>
                <button onClick={() => { setUserLocation(null); setSortBy("recommend"); }} className="text-xs bg-white text-zinc-500 px-4 py-2 rounded-xl shadow-sm font-black text-left text-left">해제</button>
              </div>
            )}

            <div className="space-y-10 text-left text-left text-left text-left">
              {firms.map((firm) => (
                <div key={firm.id} className="group flex flex-col md:flex-row bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer text-left text-left text-left" onClick={() => handleFirmClick(firm.company_ko)}>
                  <div className="w-full md:w-2/5 aspect-video md:aspect-auto bg-slate-50 border-r border-slate-100 shrink-0 relative flex items-center justify-center overflow-hidden text-left text-left">
                    <CompanyLogo companyName={firm.company_ko} className="w-full h-full text-left text-left text-left text-left" />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur shadow-sm border border-slate-100 px-3 py-1.5 rounded-full flex items-center gap-1 text-left text-left text-left text-left text-left">
                      <Calendar size={10} className="text-blue-600 text-left text-left text-left text-left text-left" />
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight leading-none text-left text-left">Since {firm.establish_year}</span>
                    </div>
                  </div>
                  <div className="flex-1 p-8 md:p-10 flex flex-col justify-center text-left text-left text-left">
                    <div className="flex justify-between items-start mb-5 text-left text-left text-left text-left">
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tighter line-clamp-1 text-left text-left text-left">{firm.company_ko}</h3>
                    </div>
                    <div className="space-y-4 font-bold text-zinc-500 text-left mb-6 text-left text-left text-left text-left text-left text-left">
                      <div className="flex items-center gap-2 text-sm text-left text-left text-left text-left text-left"><MapPin size={16} className="text-zinc-300 text-left text-left" /> {firm.address}</div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-left text-left text-left text-left text-left text-left">
                      <div className="flex items-center gap-2 text-blue-600 text-xl font-black text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><FileText size={22} className="text-left text-left" /> 실적 {firm.patentCount?.toLocaleString()}건</div>
                      <button onClick={(e) => { e.stopPropagation(); handleFirmClick(firm.company_ko); }} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-blue-600 transition-all shadow-lg active:scale-95 text-left text-left text-left text-left text-left text-left">상세보기 <ArrowRight size={14} strokeWidth={3} className="text-left text-left" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>
        </>
      ) : (
        /* 검색 결과 뷰 */
        <main className="max-w-4xl mx-auto px-4 mt-12 animate-in fade-in slide-in-from-bottom-6 duration-500 text-left text-left text-left text-left text-left text-left text-left text-left text-left">
          <div className="flex items-center gap-5 mb-12 text-left text-left text-left text-left text-left text-left">
            <button onClick={handleReset} className="p-4 bg-zinc-100 rounded-[1.5rem] text-zinc-500 hover:bg-zinc-900 hover:text-white transition-all active:scale-90 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><ChevronLeft size={28} className="text-left text-left text-left" /></button>
            <div className="text-left text-left text-left text-left text-left text-left">
              <div className="flex items-center gap-2 mb-1 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest text-left text-left text-left text-left text-left text-left text-left">
                  {activeSearchType === 'keyword' ? `SECTOR ${activeSearchCategory}` : 'FIRM SEARCH'}
                </span>
              </div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">"<span className="text-blue-600 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">{searchRefinedKey}</span>" 검색 결과</h2>
            </div>
          </div>

          <div className="space-y-10 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
            {searchLoading ? (
              <div className="py-24 text-center bg-slate-50 rounded-[3rem] border border-dashed border-slate-200 text-left text-left text-left text-left text-left text-left text-left"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4 text-left text-left text-left text-left text-left text-left text-left text-left" /><p className="text-slate-500 font-bold tracking-tight text-left text-left text-left text-left text-left text-left text-left text-left">데이터 분석 중...</p></div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result) => {
                if (activeSearchType === 'firm') {
                  return (
                    <div key={result.id} className="group flex flex-col md:flex-row bg-white rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 cursor-pointer text-left text-left text-left text-left text-left text-left text-left text-left" onClick={() => handleFirmClick(result.company_ko)}>
                      <div className="w-full md:w-2/5 aspect-video md:aspect-auto bg-slate-50 border-r border-slate-100 shrink-0 relative flex items-center justify-center overflow-hidden text-left text-left text-left text-left text-left text-left text-left text-left">
                        <CompanyLogo companyName={result.company_ko} className="w-full h-full text-left text-left text-left text-left text-left text-left text-left text-left" />
                      </div>
                      <div className="flex-1 p-8 md:p-10 flex flex-col justify-center text-left text-left text-left text-left text-left text-left text-left">
                        <div className="flex justify-between items-start mb-5 text-left text-left text-left text-left text-left text-left text-left">
                          <h3 className="text-2xl md:text-3xl font-black text-slate-900 group-hover:text-blue-600 transition-colors tracking-tighter text-left text-left text-left text-left text-left text-left text-left">{result.company_ko}</h3>
                        </div>
                        <div className="space-y-4 font-bold text-zinc-500 text-left text-left text-left text-left text-left text-left text-left mb-6 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                          <div className="flex items-center gap-2 text-sm text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><MapPin size={16} className="text-zinc-300 text-left text-left text-left text-left text-left text-left text-left" /> {result.address}</div>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-50 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                          <div className="flex items-center gap-2 text-blue-600 text-xl font-black text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><FileText size={22} className="text-left text-left text-left text-left text-left text-left" /> 실적 {result.patentCount?.toLocaleString()}건</div>
                          <button onClick={(e) => { e.stopPropagation(); handleFirmClick(result.company_ko); }} className="flex items-center gap-3 px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-blue-600 transition-all shadow-lg active:scale-95 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">상세보기 <ArrowRight size={14} strokeWidth={3} className="text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left" /></button>
                        </div>
                      </div>
                    </div>
                  );
                }

                /* [수정] 특허기반 검색 결과 카드 */
                return (
                  <div key={result.id} className="bg-white border border-slate-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group text-left text-left text-left text-left text-left text-left text-left text-left">
                    <div className="flex flex-col md:flex-row text-left text-left text-left text-left text-left text-left text-left text-left">
                      <div className="w-full md:w-64 bg-slate-50 border-r border-slate-100 flex flex-col items-center p-8 shrink-0 text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleFirmClick(result.company_ko); }}
                          className="w-full mb-6 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 active:scale-95 flex items-center justify-center gap-2 text-left"
                        >
                          사무소상세 <ArrowRight size={14} strokeWidth={3} className="text-left" />
                        </button>
                        <CompanyLogo companyName={result.company_ko} className="w-full h-full border-none mb-6 text-left text-left text-left text-left text-left text-left text-left text-left text-left" />
                        <div className="w-full space-y-3 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                          <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-600 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                            <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-slate-100">
                              <AttorneyPhoto agentCode={result.agent_code} name={result.representatives} className="w-full h-full" />
                            </div>
                            <span className="text-xs font-black text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">{result.representatives} 변리사</span>
                          </div>
                          {result.phone && (
                            <div className="flex items-center gap-3 px-4 py-2.5 bg-white rounded-xl border border-slate-100 shadow-sm text-slate-500 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                              <Phone size={16} className="text-slate-400 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left" /><span className="text-xs font-bold text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">{result.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex-1 p-8 md:p-10 space-y-6 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                        <div className="flex justify-between items-start text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                          <div className="space-y-1 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                            <h3 className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition-colors text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">{result.company_ko}</h3>
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-tight text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><MapPin size={12} className="text-left text-left" /> {result.address}</div>
                          </div>
                        </div>

                        <div className="space-y-3 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                          <div className="flex items-center gap-2 text-blue-800 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                            <Bookmark size={14} className="text-left text-left text-left text-left text-left text-left" />
                            <span className="text-sm font-black uppercase tracking-wider text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">검색된 특허 ({result.patentCount}건)</span>
                          </div>
                          <div className="grid gap-3 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                            {result.matchingPatents?.map((patent, idx) => (
                              <div
                                key={idx}
                                onClick={() => handlePatentClick(patent.app_number)}
                                className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex items-start gap-4 hover:bg-blue-100 transition-all cursor-pointer group/patent text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"
                              >
                                <div className="bg-white w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 shadow-sm shrink-0 font-black text-[10px] text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">{idx + 1}</div>
                                <div className="space-y-1 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                                  <div className="flex items-center gap-2 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">
                                    <p className="text-[13px] font-black text-blue-700 uppercase group-hover/patent:text-blue-900 transition-colors text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">출원번호 {patent.app_number}</p>
                                  </div>
                                  <p className="text-sm font-bold text-slate-700 leading-snug line-clamp-2 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">"{patent.title}"</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-24 text-center bg-slate-50 rounded-[3.5rem] border-dashed border-2 border-slate-200 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left"><Search size={40} className="mx-auto text-slate-200 mb-4 text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left" /><p className="text-slate-500 font-bold text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">매칭되는 결과가 없습니다.</p><button onClick={handleReset} className="mt-4 text-blue-600 font-black hover:underline text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left text-left">메인으로 돌아가기</button></div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
