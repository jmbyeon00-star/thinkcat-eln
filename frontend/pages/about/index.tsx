import Head from "next/head";
import Link from "next/link";
import { Brain, Database, Rocket, Cpu, ArrowRight, CheckCircle2, ShieldCheck, Layers, Gauge, SearchCode, Network } from "lucide-react";
import { withMessages } from '@/lib/i18n/withMessages';

export const getServerSideProps = withMessages();

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>IPFORCE 소개 | AI 특허 분석 플랫폼</title>
        <style>{`
    html, body {
      height: 100%;
      margin: 0;
      padding: 0;
      overflow: hidden;
      background-color: white;
    }
    #snap-container {
      height: 100vh;
      overflow-y: auto;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;

      /* 🚀 스크롤바 숨기기 핵심 코드 */
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;     /* Firefox */
    }

    /* Chrome, Safari, Opera, Brave */
    #snap-container::-webkit-scrollbar {
      display: none;
    }

    section {
      height: 100vh;
      width: 100%;
      scroll-snap-align: start;
      scroll-snap-stop: always;
      display: flex;
      align-items: center;
      position: relative;
      flex-shrink: 0;
      overflow: hidden;
    }
  `}</style>
      </Head>

      <main id="snap-container" className="selection:bg-blue-100">

        {/* SECTION 1: 심플한 Hero - 첫인상 강조 */}
        <section className="px-6 bg-white">
          <div className="max-w-5xl mx-auto w-full text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 mb-10">
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Next-Gen Patent Intelligence</span>
            </div>

            <h1 className="text-7xl md:text-8xl font-black mb-8 tracking-tighter leading-none text-zinc-900">
              IPFORCE<span className="text-blue-600">.</span>
            </h1>

            <p className="max-w-xl mx-auto text-xl text-zinc-400 leading-relaxed mb-12 font-medium">
              특허 데이터에 지능을 더해<br />
              압도적인 기술 통찰력을 제공합니다.
            </p>

            <div className="flex justify-center gap-4">
              <Link href="/project/new" className="px-10 py-5 bg-zinc-900 text-white rounded-2xl font-black shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                시작하기 <ArrowRight size={20} />
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 2: 핵심 서비스 상세 - 풍성한 정보 */}
        <section className="bg-zinc-50/50 px-6 border-y border-zinc-100">
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div>
                <h2 className="text-4xl font-black text-zinc-900 mb-3 tracking-tight">Core Intelligence</h2>
                <p className="text-zinc-500 font-medium">특허 분석 전문가를 위한 4가지 핵심 워크플로우</p>
              </div>
              <div className="text-right hidden md:block">
                <span className="text-4xl font-black text-zinc-200">01</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FeatureCard
                icon={<SearchCode className="h-6 w-6 text-white" />}
                title="Smart Ingestion"
                desc="키워드 검색만으로 정답셋과 대조군(COUNTER) 데이터를 실시간으로 수집하여 학습 데이터셋을 자동 구성합니다."
              />
              <FeatureCard
                icon={<Database className="h-6 w-6 text-white" />}
                title="Vector Storage"
                desc="방대한 텍스트 데이터를 고차원 벡터로 변환하여 MariaDB와 연동된 고성능 인덱스에 저장하고 관리합니다."
              />
              <FeatureCard
                icon={<Brain className="h-6 w-6 text-white" />}
                title="Deep Training"
                desc="프로젝트별로 독립된 BERT 모델이 생성되어 사용자의 도메인 지식을 GPU 백엔드에서 스스로 학습합니다."
              />
              <FeatureCard
                icon={<Gauge className="h-6 w-6 text-white" />}
                title="Instant Inference"
                desc="학습 즉시 미분류 데이터를 분석하여 가장 유사한 기술 분류로 자동 추천하고 신뢰도 점수를 부여합니다."
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: 기술적 차별점 (아키텍처) - 전문성 강조 */}
        <section className="bg-white px-6">
          <div className="max-w-6xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <div>
                  <h2 className="text-4xl font-black text-zinc-900 mb-6 tracking-tight leading-tight">
                    강력한 GPU 백엔드로<br />
                    분석 시간을 90% 단축하세요.
                  </h2>
                  <p className="text-zinc-500 font-medium leading-relaxed">
                    IPFORCE는 수만 건의 특허를 단 몇 분 만에 학습하고 추론할 수 있는 PyTorch 기반 고성능 인프라를 제공합니다.
                    단순한 키워드 매칭을 넘어 기술의 실제 '의미'를 파악합니다.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                    <div><h4 className="font-bold text-zinc-800">SSE 실시간 모니터링</h4><p className="text-sm text-zinc-500">모델의 학습 상태를 웹 화면에서 0.1초 단위로 실시간 확인</p></div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                    <div><h4 className="font-bold text-zinc-800">하이퍼파라미터 커스텀</h4><p className="text-sm text-zinc-500">Epoch, Batch, Learning Rate를 도메인 특성에 맞춰 세밀하게 조정</p></div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                    <div><h4 className="font-bold text-zinc-800">유사도 시각화 차트</h4><p className="text-sm text-zinc-500">수집된 데이터의 분포를 한눈에 볼 수 있는 Pie/Bar 통계 제공</p></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-8 bg-zinc-900 rounded-[2rem] text-white space-y-4">
                  <Cpu className="text-blue-500" size={32} />
                  <h3 className="text-lg font-bold">NVIDIA CUDA</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">전용 GPU 서버 할당을 통한 고속 병렬 연산 처리</p>
                </div>
                <div className="p-8 bg-blue-600 rounded-[2rem] text-white space-y-4 translate-y-8">
                  <Layers className="text-white" size={32} />
                  <h3 className="text-lg font-bold">BERT Core</h3>
                  <p className="text-xs text-blue-100 leading-relaxed">기술 문헌에 특화된 언어 모델 기반 의미 분석</p>
                </div>
                <div className="p-8 bg-zinc-50 rounded-[2rem] border space-y-4">
                  <Network className="text-blue-600" size={32} />
                  <h3 className="text-lg font-bold">API Mesh</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">FastAPI 비동기 통신을 통한 무중단 데이터 처리</p>
                </div>
                <div className="p-8 bg-zinc-100 rounded-[2rem] space-y-4 translate-y-8">
                  <ShieldCheck className="text-zinc-400" size={32} />
                  <h3 className="text-lg font-bold">Encrypted</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">기업 기밀 기술 자산을 위한 데이터 암호화 보관</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: Mission & Statistics - 신뢰성 강조 */}
        <section className="px-6 bg-zinc-900">
          <div className="max-w-5xl mx-auto w-full py-20 relative">
            <div className="absolute -top-20 -left-20 w-64 h-64 bg-blue-600/20 rounded-full blur-[100px]" />
            <div className="text-center mb-16">
              <p className="text-blue-500 font-black tracking-[0.4em] uppercase text-xs mb-8">Performance Metrics</p>
              <h2 className="text-5xl md:text-6xl font-black text-white leading-[1.1] tracking-tighter mb-10">
                데이터가 가치가 되는<br />
                <span className="text-blue-500">가장 빠른 경로.</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <p className="text-5xl font-black text-white mb-2 font-mono">98%</p>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Average Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-black text-white mb-2 font-mono">15m</p>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Training Time</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-black text-white mb-2 font-mono">1M+</p>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Patents Analyzed</p>
              </div>
              <div className="text-center">
                <p className="text-5xl font-black text-white mb-2 font-mono">0.1s</p>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Inference Speed</p>
              </div>
            </div>

            <div className="mt-20 p-10 bg-white/5 rounded-[2.5rem] border border-white/10 backdrop-blur-sm text-center">
              <p className="text-zinc-400 font-medium leading-relaxed italic">
                "IPFORCE는 단순한 도구가 아닙니다. 특허청의 거대한 데이터를 기업의 전략적 무기로 바꾸는 AI 파트너입니다.
                우리는 인간이 결정에만 집중할 수 있도록 복잡한 읽기를 대신합니다."
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: CTA - 깔끔한 마무리 */}
        <section className="flex flex-col items-center justify-center px-6 text-center bg-white">
          <Rocket className="w-16 h-16 text-blue-600 mb-8 animate-bounce" />
          <h3 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-zinc-900">분석의 격차를 만드세요</h3>
          <p className="text-zinc-500 font-medium text-lg mb-12 max-w-lg">
            지금 무료로 프로젝트를 생성하고<br />
            지능형 특허 관리 시스템을 구축해 보세요.
          </p>
          <div className="flex gap-4">
            <Link href="/project/new" className="px-12 py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
              프로젝트 생성하기
            </Link>
          </div>
          <div className="mt-20 flex gap-10 opacity-30 grayscale contrast-200">
            <span className="font-black text-2xl tracking-tighter">FastAPI</span>
            <span className="font-black text-2xl tracking-tighter">PyTorch</span>
            <span className="font-black text-2xl tracking-tighter">Next.js</span>
          </div>
          <p className="mt-16 text-zinc-300 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">© 2026 IPFORCE Intelligence</p>
        </section>

      </main>
    </>
  );
}

// ✅ 풍성한 정보를 담은 기능 카드
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string; }) {
  return (
    <div className="group bg-white rounded-[2rem] p-8 border border-zinc-100 shadow-sm hover:shadow-2xl transition-all duration-500 flex flex-col h-full hover:-translate-y-2">
      <div className="mb-8 w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg font-black text-zinc-900 mb-3 tracking-tight">{title}</h3>
      <p className="text-zinc-400 text-xs leading-relaxed font-medium group-hover:text-zinc-600 transition-colors">{desc}</p>
    </div>
  );
}