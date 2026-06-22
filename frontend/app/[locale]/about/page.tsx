'use client';

import { Link } from "@/routing";
import { Brain, Database, Rocket, Cpu, ArrowRight, CheckCircle2, ShieldCheck, Layers, Gauge, SearchCode, Network, BarChart3, Shield, TrendingUp, Globe } from "lucide-react";

export default function AboutPage() {
    return (
        <main id="snap-container" className="selection:bg-blue-100">
            <style jsx global>{`
        #snap-container {
          height: 100vh;
          overflow-y: auto;
          scroll-snap-type: y mandatory;
          scroll-behavior: smooth;
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
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

            {/* SECTION 1: Hero */}
            <section className="px-6 bg-white">
                <div className="max-w-5xl mx-auto w-full text-center">
                    <h1 className="text-7xl md:text-8xl font-black mb-8 tracking-tighter leading-none text-zinc-900">
                        THINKCAT-ELN<span className="text-red-600">.</span>
                    </h1>

                    <p className="max-w-xl mx-auto text-xl text-zinc-400 leading-relaxed mb-12 font-medium">
                        특허 데이터 분석 플랫폼
                    </p>

                    <div className="flex justify-center gap-4">
                        <Link href="/search" className="px-10 py-5 bg-zinc-900 text-white rounded-2xl font-black shadow-2xl hover:bg-black transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                            시작하기 <ArrowRight size={20} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* SECTION 2: 주요 기능 */}
            <section className="bg-zinc-50/50 px-6 border-y border-zinc-100">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                        <div>
                            <h2 className="text-4xl font-black text-zinc-900 mb-3 tracking-tight">주요 기능</h2>
                            <p className="text-zinc-500 font-medium">특허 분석을 위한 핵심 워크플로우</p>
                        </div>
                        <div className="text-right hidden md:block">
                            <span className="text-4xl font-black text-zinc-200">01</span>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <FeatureCard
                            icon={<SearchCode className="h-6 w-6 text-white" />}
                            title="데이터 수집"
                            desc="키워드 검색으로 정답셋과 대조군 데이터를 수집하여 학습 데이터셋을 구성합니다."
                        />
                        <FeatureCard
                            icon={<Database className="h-6 w-6 text-white" />}
                            title="벡터 저장"
                            desc="텍스트 데이터를 벡터로 변환하여 MariaDB와 연동된 인덱스에 저장하고 관리합니다."
                        />
                        <FeatureCard
                            icon={<Brain className="h-6 w-6 text-white" />}
                            title="모델 학습"
                            desc="프로젝트별로 독립된 BERT 모델이 생성되어 도메인 지식을 GPU 백엔드에서 학습합니다."
                        />
                        <FeatureCard
                            icon={<Gauge className="h-6 w-6 text-white" />}
                            title="추론 및 분류"
                            desc="학습된 모델로 미분류 데이터를 분석하여 유사한 기술 분류를 추천하고 신뢰도를 제공합니다."
                        />
                    </div>
                </div>
            </section>

            {/* SECTION 3: GPU 백엔드 */}
            <section className="bg-white px-6">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-4xl font-black text-zinc-900 mb-6 tracking-tight leading-tight">
                                    GPU 백엔드 기반<br />
                                    고성능 분석 환경
                                </h2>
                                <p className="text-zinc-500 font-medium leading-relaxed">
                                    THINKCAT-ELN은 PyTorch 기반의 GPU 인프라를 통해 대량의 특허 데이터를 빠르게 학습하고 추론합니다.
                                    키워드 매칭을 넘어 기술의 의미를 기반으로 분석합니다.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                                    <div><h4 className="font-bold text-zinc-800">SSE 실시간 모니터링</h4><p className="text-sm text-zinc-500">모델 학습 상태를 웹 화면에서 실시간 확인</p></div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                                    <div><h4 className="font-bold text-zinc-800">하이퍼파라미터 설정</h4><p className="text-sm text-zinc-500">Epoch, Batch, Learning Rate를 도메인 특성에 맞게 조정</p></div>
                                </div>
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 p-1 bg-blue-50 rounded-md text-blue-600"><CheckCircle2 size={16} /></div>
                                    <div><h4 className="font-bold text-zinc-800">유사도 시각화</h4><p className="text-sm text-zinc-500">수집 데이터 분포를 Pie/Bar 차트로 확인</p></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-8 bg-zinc-900 rounded-[2rem] text-white space-y-4">
                                <Cpu className="text-blue-500" size={32} />
                                <h3 className="text-lg font-bold">NVIDIA CUDA</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">전용 GPU 서버를 통한 고속 병렬 연산</p>
                            </div>
                            <div className="p-8 bg-blue-600 rounded-[2rem] text-white space-y-4 translate-y-8">
                                <Layers className="text-white" size={32} />
                                <h3 className="text-lg font-bold">BERT Core</h3>
                                <p className="text-xs text-blue-100 leading-relaxed">기술 문헌에 특화된 언어 모델 기반 분석</p>
                            </div>
                            <div className="p-8 bg-zinc-50 rounded-[2rem] border space-y-4">
                                <Network className="text-blue-600" size={32} />
                                <h3 className="text-lg font-bold">API</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">FastAPI 비동기 통신을 통한 데이터 처리</p>
                            </div>
                            <div className="p-8 bg-zinc-100 rounded-[2rem] space-y-4 translate-y-8">
                                <ShieldCheck className="text-zinc-400" size={32} />
                                <h3 className="text-lg font-bold">보안</h3>
                                <p className="text-xs text-zinc-500 leading-relaxed">기업 기술 자산을 위한 데이터 암호화</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 4: 서비스 소개 */}
            <section className="bg-zinc-50/30 px-6">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="mb-12">
                        <span className="text-blue-600 font-black text-xs uppercase tracking-widest mb-4 block">About THINKCAT-ELN</span>
                        <h2 className="text-4xl md:text-5xl font-black text-zinc-900 leading-[1.1] tracking-tighter mb-6">
                            특허 데이터를<br />분석 가능한 형태로.
                        </h2>
                        <p className="text-zinc-500 text-lg leading-relaxed max-w-3xl font-medium">
                            THINKCAT-ELN은 특허 검색 및 분류 작업을 효율화하여
                            실적 데이터 기반의 신뢰할 수 있는 분석 서비스를 제공합니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-8 bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <BarChart3 className="text-blue-600" size={24} />
                            </div>
                            <h4 className="text-xl font-bold mb-3">데이터 중심 분석</h4>
                            <p className="text-zinc-400 text-sm leading-relaxed font-medium">전국 특허 사무소의 출원 및 등록 실적을 기술 분야별(CPC)로 분석하여 객관적인 지표를 제공합니다.</p>
                        </div>
                        <div className="p-8 bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Shield className="text-blue-600" size={24} />
                            </div>
                            <h4 className="text-xl font-bold mb-3">검증된 전문가 정보</h4>
                            <p className="text-zinc-400 text-sm leading-relaxed font-medium">경력, 전문 분야, 주요 실적이 확인된 변리사 정보를 투명하게 공개합니다.</p>
                        </div>
                        <div className="p-8 bg-white border border-zinc-100 rounded-[2.5rem] shadow-sm hover:shadow-xl transition-all group">
                            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <TrendingUp className="text-blue-600" size={24} />
                            </div>
                            <h4 className="text-xl font-bold mb-3">유사도 기반 매칭</h4>
                            <p className="text-zinc-400 text-sm leading-relaxed font-medium">기술 키워드와 유사한 특허 실적을 보유한 사무소를 Milvus 엔진으로 찾아냅니다.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 5: 전문가 매칭 CTA */}
            <section className="px-6 bg-white">
                <div className="max-w-6xl mx-auto w-full">
                    <div className="relative overflow-hidden bg-zinc-900 rounded-[3.5rem] p-12 md:p-20 text-white shadow-2xl">
                        <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none">
                            <Globe size={400} />
                        </div>

                        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                            <div className="flex-1 text-left">
                                <h3 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">데이터로 증명된 전문가를<br />지금 바로 만나보세요.</h3>
                                <p className="text-zinc-400 text-lg font-medium max-w-lg leading-relaxed">
                                    실제 데이터 기반의 실적으로 검증된 전문가를 연결해 드립니다.
                                </p>
                            </div>
                            <Link
                                href="/attorney"
                                className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-[2rem] font-black text-xl transition-all shadow-2xl shadow-blue-600/30 hover:scale-105 active:scale-95"
                            >
                                전문가 찾기
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* SECTION 6: CTA */}
            <section className="flex flex-col items-center justify-center px-6 text-center bg-white">
                <Rocket className="w-16 h-16 text-blue-600 mb-8 animate-bounce" />
                <h3 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-zinc-900">특허 검색을 시작하세요</h3>
                <p className="text-zinc-500 font-medium text-lg mb-12 max-w-lg">
                    프로젝트를 생성하고<br />
                    특허 데이터 분석을 시작해 보세요.
                </p>
                <div className="flex gap-4">
                    <Link href="/search" className="px-12 py-5 bg-blue-600 text-white rounded-[2rem] font-black shadow-2xl shadow-blue-100 hover:bg-blue-700 transition-all hover:scale-105 active:scale-95">
                        특허 검색
                    </Link>
                </div>
                <div className="mt-20 flex gap-10 opacity-30 grayscale contrast-200">
                    <span className="font-black text-2xl tracking-tighter">FastAPI</span>
                    <span className="font-black text-2xl tracking-tighter">PyTorch</span>
                    <span className="font-black text-2xl tracking-tighter">Next.js</span>
                </div>
                <p className="mt-16 text-zinc-300 font-mono text-[10px] uppercase tracking-[0.3em] font-bold">© 2026 THINKCAT-ELN</p>
            </section>

        </main>
    );
}

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
