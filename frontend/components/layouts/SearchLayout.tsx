import Stepper from "./SearchStepper";
import { Sparkles, ArrowLeft } from "lucide-react";
import { useRouter } from "next/router";

export default function SearchLayout({
  step = 0,
  keyword,
  number,
  children,
}: {
  step?: number;
  keyword?: string;
  number?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const stepItems = [
    { label: "환경 설정", href: "/search" },
    { label: "검색 결과", href: keyword ? `/search/keyword/${keyword}` : "#" },
    { label: "특허 상세", href: number ? `/search/detail/${number}` : "#" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12 selection:bg-blue-100">
      {/* 1. Page Header: 세련된 타이포그래피와 뒤로가기 조합 */}
      <header className="mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600">
              <Sparkles size={12} className="fill-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Intellectual Property Search</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-900 leading-none">
              특허 지능 검색<span className="text-blue-600">.</span>
            </h1>
            <p className="text-zinc-400 font-medium text-lg leading-relaxed">
              데이터베이스에 접근하여 최적의 기술 정보를 추론합니다.
            </p>
          </div>

          {/* 브라우저 히스토리 기반 뒤로가기 버튼 */}
        </div>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-zinc-400 hover:text-zinc-900 font-bold transition-all group text-sm mt-5"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> 이전 단계로
        </button>
      </header>

      {/* 2. Stepper Container: 배경색과 라운딩으로 구분감 부여 */}
      {/* <div className="mb-12 bg-zinc-50/50 p-6 md:p-8 rounded-[2rem] border border-zinc-100 shadow-inner animate-in fade-in duration-1000">
        <div className="max-w-3xl mx-auto">
          <Stepper step={step} items={stepItems} />
        </div>
      </div> */}

      {/* 3. Main Content: 자식 컴포넌트 렌더링 영역 */}
      <main className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
        {children}
      </main>

      {/* 4. Mini Footer: 전문성 강조 */}
      <footer className="mt-20 pt-10 border-t border-zinc-50 flex items-center justify-between opacity-30">
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.4em]">IPFORCE Search Mesh v2.0</p>
        <div className="flex gap-4">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="System Online" />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="AI Training Ready" />
        </div>
      </footer>
    </div>
  );
}