import Head from "next/head";
import { Brain, Database, Rocket, BarChart3, Cpu, ArrowRight, ShieldCheck, Zap, Layers, UploadCloud, Search, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { withMessages } from '@/lib/i18n/withMessages';

export const getServerSideProps = withMessages();

// 프로젝트 메인화면과 동일한 컬러 상수 적용
const BRAND_BLUE = "#2563eb"; // blue-600
const ZINC_900 = "#18181b"; // zinc-900

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>IPFORCE 소개 | AI 특허 분석 플랫폼</title>
      </Head>

      <main className="min-h-screen bg-white text-zinc-900 overflow-hidden">
        {/* 1. Hero Section: 프로젝트 대시보드의 청결한 느낌 유지 */}
        <section className="relative pt-32 pb-24 px-6 border-b border-zinc-50">
          <div className="max-w-5xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-8">
              <Zap size={14} className="fill-blue-600" />
              <span className="text-xs font-black uppercase tracking-widest">Enterprise AI Platform</span>
            </div>

            <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tight leading-[1.1]">
              특허 데이터에<br />
              <span className="text-blue-600">지능을 더하다.</span>
            </h1>

            <p className="max-w-2xl text-lg text-zinc-500 leading-relaxed mb-10 font-medium">
              <b className="text-zinc-900">IPFORCE</b>는 특허 문헌의 의미를 이해하는 BERT 기반 AI 플랫폼입니다.
              데이터 수집부터 GPU 가속 학습, 유사 특허 추론까지
              특허 분석의 모든 과정을 자동화합니다.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/project" className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all flex items-center gap-2">
                내 프로젝트 보기 <ArrowRight size={20} />
              </Link>
              <Link href="/project/new" className="px-8 py-4 bg-zinc-900 text-white rounded-2xl font-black hover:bg-black transition-all">
                신규 프로젝트 생성
              </Link>
            </div>
          </div>
        </section>

        {/* 2. Core Service: 프로젝트 리스트의 카드 스타일 차용 */}
        <section className="max-w-5xl mx-auto px-6 py-24">
          <div className="mb-12">
            <h2 className="text-3xl font-black text-zinc-900 mb-2">핵심 서비스</h2>
            <p className="text-zinc-500 font-medium">데이터 유입부터 분석까지 이어지는 IPFORCE의 기술력</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <FeatureCard
              icon={<Database className="h-7 w-7 text-white" />}
              title="검색 기반 데이터 수집"
              desc="특허청 DB와 실시간 연동되어 키워드 기반으로 방대한 정답 및 COUNTER 세트를 즉시 구성합니다."
              tag="Search-type"
            />
            <FeatureCard
              icon={<UploadCloud className="h-7 w-7 text-white" />}
              title="사용자 데이터 업로드"
              desc="보유 중인 엑셀, CSV 데이터를 직접 업로드하여 기업 고유의 기술 분류 체계를 학습시킵니다."
              tag="Upload-type"
            />
            <FeatureCard
              icon={<Brain className="h-7 w-7 text-white" />}
              title="AI 모델 자동 학습"
              desc="데이터 셋 구성 완료 시, GPU 백엔드에서 BERT 모델 학습이 자동으로 시작되어 고성능 분류기를 생성합니다."
              tag="PyTorch/CUDA"
            />
            <FeatureCard
              icon={<BarChart3 className="h-7 w-7 text-white" />}
              title="유사 특허 지능 추천"
              desc="학습된 모델이 미분류 특허들을 분석하여 가장 유사한 기술 그룹으로 자동 매칭 및 추천합니다."
              tag="Inference"
            />
          </div>
        </section>

        {/* 3. Tech Stack: 프로젝트 관리 화면의 Status 색상 테마 적용 */}
        <section className="bg-zinc-50 border-y border-zinc-100 py-24">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-3 gap-12">
              <div className="space-y-4">
                <div className="px-3 py-1 w-fit rounded-lg bg-blue-100 text-blue-700 border border-blue-200 text-xs font-black uppercase">Phase 1-2</div>
                <h3 className="text-xl font-black text-zinc-900">Frontend Ecosystem</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                  Next.js와 Tailwind로 구축된 인터랙티브 UI는 실시간 SSE 통신을 통해 모델 학습 과정을 초 단위로 모니터링합니다.
                </p>
              </div>
              <div className="space-y-4">
                <div className="px-3 py-1 w-fit rounded-lg bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black uppercase">Phase 3-4</div>
                <h3 className="text-xl font-black text-zinc-900">API & GPU Server</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                  FastAPI 기반의 고성능 서버가 프로젝트 리소스를 관리하며, 독립된 GPU 서버에서 딥러닝 연산을 분산 처리합니다.
                </p>
              </div>
              <div className="space-y-4">
                <div className="px-3 py-1 w-fit rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black uppercase">Complete</div>
                <h3 className="text-xl font-black text-zinc-900">Security & Scale</h3>
                <p className="text-zinc-500 text-sm leading-relaxed font-medium">
                  MariaDB와 Docker 환경을 통해 데이터 무결성을 보장하며, 수십만 건의 특허 벡터 검색을 위한 확장성을 제공합니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Mission: 블랙 테마 포인트 */}
        <section className="py-24 max-w-5xl mx-auto px-6">
          <div className="bg-zinc-900 rounded-[3rem] p-12 md:p-20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-0 left-1/4 w-px h-full bg-white rotate-12" />
              <div className="absolute top-0 right-1/4 w-px h-full bg-white -rotate-12" />
            </div>
            <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-xs mb-8">Vision & Mission</p>
            <h2 className="text-3xl md:text-5xl font-black text-white leading-tight tracking-tighter mb-10">
              “방대한 특허 속에 숨겨진<br />
              기술의 가치를 <span className="text-blue-500">지도로 만듭니다.</span>”
            </h2>
            <div className="flex flex-wrap justify-center gap-8">
              <div className="flex items-center gap-2 text-white/60 font-bold"><CheckCircle2 size={18} className="text-blue-500" /> 데이터 자동화</div>
              <div className="flex items-center gap-2 text-white/60 font-bold"><CheckCircle2 size={18} className="text-blue-500" /> 인공지능 통찰</div>
              <div className="flex items-center gap-2 text-white/60 font-bold"><CheckCircle2 size={18} className="text-blue-500" /> 전략적 의사결정</div>
            </div>
          </div>
        </section>

        {/* 5. Footer CTA */}
        <section className="max-w-5xl mx-auto px-6 pb-32 text-center">
          <h3 className="text-2xl font-black mb-4">지금 첫 번째 프로젝트를 시작하세요</h3>
          <p className="text-zinc-500 font-medium mb-10">AI 특허 분석으로 새로운 기술 트렌드를 발견할 준비가 되셨나요?</p>
          <Link href="/project/new" className="inline-flex items-center gap-3 bg-blue-600 text-white px-12 py-5 rounded-[2rem] font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all hover:scale-105">
            프로젝트 생성하기 <Rocket size={20} />
          </Link>
        </section>
      </main>
    </>
  );
}

// ✅ 메인 대시보드 카드 스타일과 통합된 카드 컴포넌트
function FeatureCard({ icon, title, desc, tag }: { icon: React.ReactNode; title: string; desc: string; tag: string; }) {
  return (
    <div className="group bg-white rounded-[2.5rem] p-8 border border-zinc-100 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-300 flex flex-col h-full">
      <div className="flex justify-between items-start mb-8">
        <div className="rounded-2xl bg-blue-600 p-4 shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <span className="bg-zinc-50 text-zinc-400 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border">{tag}</span>
      </div>
      <h3 className="text-xl font-black text-zinc-900 mb-3 group-hover:text-blue-600 transition-colors">{title}</h3>
      <p className="text-zinc-500 text-sm leading-relaxed font-medium">{desc}</p>
    </div>
  );
}