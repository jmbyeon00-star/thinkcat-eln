'use client';

import { Link } from '@/routing';
import { ArrowRight, FlaskConical, ClipboardList, ShieldCheck, Building2, FileSearch, Megaphone, SearchCheck } from 'lucide-react';

const SERVICES = [
  {
    title: '변리사검색',
    desc: '특허·법률 사무소 정보를 빠르게 검색하고 적합한 파트너를 찾을 수 있습니다.',
    cta: '변리사 검색하기',
    href: '/agent/marketplace',
    external: false,
    icon: Building2,
  },
  {
    title: '특허검색',
    desc: '국내외 특허 데이터베이스를 통한 검색으로 기술 동향과 선행기술을 분석합니다.',
    cta: '특허 검색하기',
    href: '/search',
    external: false,
    icon: FileSearch,
  },
  {
    title: '선행기술조사',
    desc: '출원 전 유사 특허와 선행기술을 조사하여 등록 가능성을 미리 진단합니다.',
    cta: '선행기술 조사하기',
    href: '/prior-art',
    external: false,
    icon: SearchCheck,
  },
  {
    title: 'R&D공고검색',
    desc: '정부·공공기관의 R&D 과제 공고를 통한 검색으로 지원 기회를 놓치지 않습니다.',
    cta: '공고 검색하기',
    href: '/announcement',
    external: false,
    icon: Megaphone,
  },
  {
    title: '전자연구노트',
    desc: '실험 과정과 결과를 체계적으로 기록하고, 연구 데이터의 원본성과 무결성을 보장합니다.',
    cta: '연구노트 작성하기',
    href: 'https://www.thinkcat.kr/portal',
    external: true,
    icon: FlaskConical,
  },
  {
    title: '과제관리',
    desc: '연구 과제의 기획부터 완료까지 전 과정을 투명하게 관리하고 실시간으로 추적합니다.',
    cta: '과제 대시보드 진입',
    href: 'https://www.thinkcat.kr/portal',
    external: true,
    icon: ClipboardList,
  },
  {
    title: 'IP관리',
    desc: '특허·상표·디자인 등 지식재산을 전사 차원에서 통합 관리하고 자산화합니다.',
    cta: '지식재산 관리하기',
    href: 'https://www.thinkcat.kr/portal',
    external: true,
    icon: ShieldCheck,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white relative overflow-hidden">
      {/* 은은한 배경 장식 */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-[-10%] right-[5%] w-[28rem] h-[28rem] bg-blue-50 rounded-full blur-[120px] opacity-70" />
        <div className="absolute bottom-[-5%] left-[0%] w-80 h-80 bg-slate-100 rounded-full blur-[100px] opacity-60" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-16">

        {/* Hero */}
        <div className="text-center mb-14 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* <div className="text-center pt-10 mb-16 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700"> */}
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-zinc-900">
            씽캣 <span className="text-blue-600">지식재산 플랫폼</span>
          </h1>
          {/* <p className="text-base text-zinc-400 font-medium leading-relaxed"> */}
          <p className="text-base text-zinc-400 font-medium">
            특허 검색부터 사무소 매칭, R&D 공고까지 <br /> 연구 성과의 자산화를 돕는 스마트 IP 서비스입니다.
          </p>
        </div>

        {/* 검색 서비스 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {SERVICES.filter(s => !s.external).map((svc) => {
            const Icon = svc.icon;
            return (
              <Link
                key={svc.title}
                href={svc.href as any}
                className="group border border-zinc-200 rounded-[1.25rem] p-6 flex flex-col min-h-[190px] bg-white hover:border-blue-500 hover:shadow-xl hover:shadow-blue-100/70 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex-1">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:scale-105 transition-all">
                    <Icon size={20} className="text-blue-600 group-hover:text-white transition-colors" />
                  </div>
                  <h2 className="text-zinc-900 font-black text-base mb-2">{svc.title}</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed">{svc.desc}</p>
                </div>
                <div className="mt-4 flex items-center gap-1 text-blue-600 font-black text-sm">
                  {svc.cta}
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            );
          })}
        </div>

        {/* 통합 플랫폼 묶음 */}
        <div className="relative bg-gradient-to-br from-blue-600 to-blue-700 rounded-[1.75rem] p-5 shadow-xl shadow-blue-200/60 animate-in fade-in slide-in-from-bottom-4 duration-700">

          <div className="relative flex items-center justify-between mb-4 px-1">
            <span className="text-[11px] font-black text-white uppercase tracking-[0.1em]">씽캣 ELN 통합 플랫폼</span>
            <a href="https://www.thinkcat.kr/portal" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-bold text-white/80 hover:text-white transition-colors group/link">
              통합 페이지 바로가기 <ArrowRight size={12} className="group-hover/link:translate-x-0.5 transition-transform" />
            </a>
          </div>
          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-3">
            {SERVICES.filter(s => s.external).map((svc) => {
              const Icon = svc.icon;
              return (
                <a
                  key={svc.title}
                  href={svc.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group border border-white/20 rounded-2xl p-6 flex flex-col min-h-[190px] bg-white/10 backdrop-blur-sm hover:bg-white/20 hover:border-white/40 hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex-1">
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center mb-4 group-hover:bg-white group-hover:scale-105 transition-all">
                      <Icon size={20} className="text-white group-hover:text-blue-600 transition-colors" />
                    </div>
                    <h2 className="text-white font-black text-base mb-2">{svc.title}</h2>
                    <p className="text-blue-100 text-sm leading-relaxed">{svc.desc}</p>
                  </div>
                  <div className="mt-4 flex items-center gap-1 text-white/80 font-black text-sm group-hover:text-white transition-colors">
                    {svc.cta}
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </div>
    </main>
  );
}
