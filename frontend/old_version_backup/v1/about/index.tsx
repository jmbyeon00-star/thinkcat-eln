"use client";

import Head from "next/head";
import { Brain, Database, Rocket, BarChart3, Cpu } from "lucide-react";
import Link from "next/link";

const BRAND_BLUE = "#00548A";
const BRAND_GRAY = "#3A3736";

export default function AboutPage() {
  return (
    <>
      <Head>
        <title>IPFORCE 소개 | AI 특허 분석 플랫폼</title>
      </Head>

      <main className="min-h-screen bg-gradient-to-b from-zinc-50 to-white" style={{ color: BRAND_GRAY }}>
        <section className="max-w-6xl mx-auto px-6 py-20">
          {/* 로고 */}
          {/* <div className="flex items-center gap-2 mb-8">
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: BRAND_BLUE }}>
              IP
            </h1>
            <span className="text-4xl font-bold" style={{ color: "#1F1B1A" }}>-</span>
            <h1 className="text-5xl font-bold tracking-tight" style={{ color: BRAND_GRAY }}>
              Force
            </h1>
          </div> */}
            <h1 className="text-4xl font-bold mb-6 text-zinc-900">
                IPFORCE<span className="text-emerald-600">.</span>
            </h1>
          <p className="text-lg leading-relaxed mb-12 text-zinc-600">
            <b style={{ color: BRAND_BLUE }}>IPFORCE</b>는 특허 데이터에 특화된 인공지능 플랫폼으로,  
            방대한 특허 문헌을 기반으로 <b>AI 분석, 추천, 요약, 가치평가</b>를 수행합니다.  
            연구개발, 출원 전략, 기술 투자에 필요한 인사이트를 빠르고 정확하게 제공합니다.
          </p>

          {/* 핵심 기능 */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <FeatureCard
              icon={<Database className="w-10 h-10" style={{ color: BRAND_BLUE }} />}
              title="데이터 통합"
              desc="특허청, 논문, 기업 데이터를 통합 수집하여 일관된 데이터셋을 구성합니다."
            />
            <FeatureCard
              icon={<Brain className="w-10 h-10" style={{ color: BRAND_BLUE }} />}
              title="AI 학습/추론"
              desc="BERT 기반 모델이 문장 의미를 벡터화하고, 유사도 기반 추천을 수행합니다."
            />
            <FeatureCard
              icon={<BarChart3 className="w-10 h-10" style={{ color: BRAND_BLUE }} />}
              title="자동 분석"
              desc="특허 가치평가, 기술 분류, 경쟁사 트렌드 분석을 자동으로 수행합니다."
            />
            <FeatureCard
              icon={<Rocket className="w-10 h-10" style={{ color: BRAND_BLUE }} />}
              title="GPU 백엔드"
              desc="PyTorch 기반 GPU 서버가 실시간 학습·추론을 처리하여 고성능 분석을 제공합니다."
            />
          </div>

          {/* 아키텍처 */}
          <div className="border-t border-zinc-200 pt-10 mb-16">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: BRAND_GRAY }}>
              시스템 아키텍처
            </h2>
            <p className="text-zinc-600 mb-6 leading-relaxed">
              IPFORCE는 <b>Frontend (Next.js)</b> · <b>Backend (FastAPI)</b> · <b>GPU Backend (PyTorch)</b>  
              3계층 구조로 구성되어 있습니다.  
              모든 학습·추론 작업은 GPU 백엔드에서 실행되며,  
              진행률과 결과는 SSE를 통해 실시간으로 프론트엔드로 전달됩니다.
            </p>
            <div className="grid md:grid-cols-3 gap-6 text-center">
              <ArchCard title="Frontend" desc="Next.js + Tailwind 기반의 인터랙티브 웹 UI" />
              <ArchCard title="Backend" desc="FastAPI 기반 REST API, MariaDB와 연동" />
              <ArchCard title="GPU Backend" desc="PyTorch + CUDA로 모델 학습 및 추론 담당" />
            </div>
          </div>

          {/* 미션 */}
          <div className="border-t border-zinc-200 pt-10 mb-16">
            <h2 className="text-2xl font-semibold mb-4" style={{ color: BRAND_GRAY }}>
              IPFORCE의 미션
            </h2>
            <p className="text-zinc-600 mb-8 leading-relaxed">
              특허 정보는 세상에서 가장 방대한 기술 문헌입니다.  
              그러나 그 정보는 복잡하고, 중복되며, 빠르게 변화합니다.  
              IPFORCE는 이러한 데이터를 <b>인공지능이 읽고, 이해하고, 요약하여</b>  
              누구나 활용 가능한 지식으로 바꾸는 것을 목표로 합니다.
            </p>
            <div className="rounded-xl p-8 shadow-md" style={{ backgroundColor: BRAND_BLUE, color: "white" }}>
              <p className="text-xl font-semibold mb-2">“AI가 읽고, 사람이 결정하는 세상.”</p>
              <p className="text-sm opacity-90">
                IPFORCE는 인간의 직관과 AI의 통찰력을 연결합니다.
              </p>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center border-t border-zinc-200 pt-12">
            <h2 className="text-2xl font-bold mb-4" style={{ color: BRAND_GRAY }}>
              IPFORCE와 함께 하세요
            </h2>
            <p className="text-zinc-600 mb-8">
              지금 바로 프로젝트를 생성하고, AI의 인사이트로 새로운 가치를 발견하세요.
            </p>
            <Link
              href="/project/new"
              className="inline-block text-white px-6 py-3 rounded-lg transition"
              style={{ backgroundColor: BRAND_BLUE }}
            >
              프로젝트 시작하기 →
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

// ✅ 기능 카드
function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-6 border rounded-xl bg-white shadow-sm hover:shadow-md transition">
      <div className="flex items-center gap-3 mb-3">{icon}<h3 className="font-semibold text-lg">{title}</h3></div>
      <p className="text-sm text-zinc-600">{desc}</p>
    </div>
  );
}

// ✅ 아키텍처 카드
function ArchCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-6 border rounded-lg bg-white shadow-sm hover:shadow-md transition">
      <h3 className="text-lg font-semibold mb-2" style={{ color: "#00548A" }}>
        {title}
      </h3>
      <p className="text-sm text-zinc-600">{desc}</p>
    </div>
  );
}
