import React from "react";
import Header from "@/components/layouts/AgentHeader";
import { BarChart3, Shield, TrendingUp, Globe } from "lucide-react";

/**
 * [소개 페이지]
 * 파일 경로: /app/[locale]/agent/about/page.tsx
 */
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-900 selection:bg-blue-600 selection:text-white">
      {/* <Header /> */}

      <main className="max-w-5xl mx-auto py-20 px-6 text-left animate-in fade-in duration-700">
        {/* 히어로 섹션 */}
        <div className="mb-20 text-left">
          <span className="text-blue-600 font-black text-sm uppercase tracking-widest mb-4 block">About THINKCAT-ELN</span>
          <h2 className="text-5xl md:text-6xl font-black text-zinc-900 leading-[1.1] tracking-tighter mb-8">
            대한민국 특허 시장의<br />새로운 기준을 제시합니다.
          </h2>
          <p className="text-zinc-500 text-xl leading-relaxed max-w-3xl font-medium">
            THINKCAT-ELN은 복잡하고 불투명했던 특허 사무소 검색 시스템을 혁신하여,
            실적 데이터 기반의 신뢰할 수 있는 매칭 서비스를 제공합니다. 기술과 사람을 잇는 가장 똑똑한 방법입니다.
          </p>
        </div>

        {/* 가치 제안 섹션 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-24 text-left">
          {[
            {
              icon: <BarChart3 className="text-blue-600" />,
              title: "데이터 중심 분석",
              desc: "전국 특허 사무소의 실제 출원 및 등록 실적을 기술 분야별(CPC)로 정밀하게 분석하여 객관적인 지표를 제공합니다."
            },
            {
              icon: <Shield className="text-blue-600" />,
              title: "검증된 전문가 그룹",
              desc: "경력, 전문 분야, 주요 실적이 검증된 변리사 정보를 투명하게 공개하여 사용자가 직접 신뢰를 판단할 수 있습니다."
            },
            {
              icon: <TrendingUp className="text-blue-600" />,
              title: "유사도 기반 매칭",
              desc: "사용자의 기술 키워드와 가장 유사한 특허 실적을 보유한 사무소를 Milvus 엔진을 통해 정확하게 찾아냅니다."
            },
          ].map((item, i) => (
            <div key={i} className="p-10 bg-white border border-zinc-100 rounded-[3rem] shadow-sm hover:shadow-2xl transition-all group">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                {item.icon}
              </div>
              <h4 className="text-2xl font-bold mb-4">{item.title}</h4>
              <p className="text-zinc-400 text-base leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* 하단 CTA 섹션 */}
        <div className="relative overflow-hidden bg-zinc-900 rounded-[3.5rem] p-12 md:p-20 text-white text-left">
          {/* 장식용 배경 요소 */}
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <Globe size={300} />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12 text-left">
            <div className="flex-1 text-left">
              <h3 className="text-4xl font-bold mb-6">데이터로 증명된 전문가를<br />지금 바로 만나보세요.</h3>
              <p className="text-zinc-400 text-lg font-medium max-w-lg leading-relaxed">
                더 이상 지인 추천이나 홍보 문구에 의존하지 마세요. 실제 데이터 기반의 실적으로 증명된 최고의 전문가를 연결해 드립니다.
              </p>
            </div>
            {/* [수정] <a> 태그를 사용하여 /agent/marketplace 로 이동하도록 설정 */}
            <a
              href="/agent/marketplace"
              className="px-12 py-6 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black text-lg transition-all shadow-2xl shadow-blue-600/30 active:scale-95 text-center decoration-0 no-underline"
            >
              검색 서비스 시작하기
            </a>
          </div>
        </div>
      </main>

      {/* 심플 푸터 */}
      {/* <footer className="py-12 border-t border-zinc-100 text-center text-left">
        <p className="text-zinc-300 text-xs font-black uppercase tracking-widest">
          © 2024 THINKCAT-ELN. All rights reserved.
        </p>
      </footer> */}
    </div>
  );
}
