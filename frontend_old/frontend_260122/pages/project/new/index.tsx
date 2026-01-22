import Head from "next/head";
import Link from "next/link";
import { Database, UploadCloud, ArrowRight, CheckCircle2, Sparkles, Info } from "lucide-react";
import { withMessages } from '@/lib/i18n/withMessages';

export const getServerSideProps = withMessages();

export default function NewProjectIndex() {
  return (
    <>
      <Head>
        <title>새 프로젝트 만들기 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-white selection:bg-blue-100">
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-32">

          {/* Header: 심플하지만 강렬한 타이포그래피 */}
          <div className="mb-20 text-center animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 mb-6">
              <Sparkles size={14} className="fill-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">New Workspace</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-zinc-900 tracking-tighter mb-6">
              프로젝트 시작하기<span className="text-blue-600">.</span>
            </h1>
            <p className="text-zinc-400 font-medium text-lg max-w-xl mx-auto">
              데이터 수집 방식을 선택하여 <br className="md:hidden" /> 지능형 특허 분석 환경을 구축하세요.
            </p>
          </div>

          {/* Cards Grid: 대시보드 스타일의 2.5rem 라운드 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">

            {/* File Upload Card */}
            <Link href="/project/new/upload" className="group">
              <div className="bg-white rounded-[2.5rem] border border-zinc-100 p-10 shadow-sm hover:shadow-2xl hover:border-blue-200 transition-all duration-500 h-full flex flex-col relative overflow-hidden">
                {/* 배경 장식 */}
                <div className="absolute -right-6 -bottom-6 text-zinc-50 opacity-10 group-hover:opacity-20 transition-opacity">
                  <UploadCloud size={180} />
                </div>

                <div className="flex justify-between items-start mb-12 relative z-10">
                  <div className="rounded-2xl bg-blue-600 p-5 shadow-lg shadow-blue-100 text-white group-hover:scale-110 transition-transform duration-500">
                    <UploadCloud size={32} />
                  </div>
                  <div className="w-10 h-10 rounded-full border border-zinc-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    <ArrowRight size={20} />
                  </div>
                </div>

                <div className="relative z-10">
                  <h2 className="text-3xl font-black text-zinc-900 mb-4 tracking-tight">파일 업로드</h2>
                  <p className="text-zinc-400 font-medium leading-relaxed mb-8">
                    CSV, Excel 등 로컬에 보유한 특허 데이터를 <br /> 직접 업로드하여 분석 프로젝트를 생성합니다.
                  </p>

                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm font-bold text-zinc-600">
                      <CheckCircle2 size={16} className="text-blue-600" /> CSV, XLSX 정식 지원
                    </li>
                    <li className="flex items-center gap-3 text-sm font-bold text-zinc-600">
                      <CheckCircle2 size={16} className="text-blue-600" /> 대용량 벌크 데이터 처리
                    </li>
                  </ul>
                </div>

                <div className="mt-12 pt-6 border-t border-zinc-50 relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">Best for Quick Start</span>
                </div>
              </div>
            </Link>

            {/* DB Search Card */}
            <Link href="/project/new/search" className="group">
              <div className="bg-zinc-900 rounded-[2.5rem] p-10 shadow-xl shadow-zinc-200 hover:shadow-2xl hover:translate-y-[-4px] transition-all duration-500 h-full flex flex-col relative overflow-hidden">
                {/* 배경 장식 */}
                <div className="absolute -right-6 -bottom-6 text-white opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                  <Database size={180} />
                </div>

                <div className="flex justify-between items-start mb-12 relative z-10">
                  <div className="rounded-2xl bg-zinc-800 p-5 shadow-lg text-white group-hover:bg-blue-600 transition-colors duration-500">
                    <Database size={32} />
                  </div>
                  <div className="w-10 h-10 rounded-full border border-zinc-700 flex items-center justify-center text-white group-hover:bg-white group-hover:text-zinc-900 group-hover:border-white transition-all">
                    <ArrowRight size={20} />
                  </div>
                </div>

                <div className="relative z-10">
                  <h2 className="text-3xl font-black text-white mb-4 tracking-tight">데이터 베이스 검색</h2>
                  <p className="text-zinc-500 font-medium leading-relaxed mb-8">
                    특허청 실시간 DB 연동을 통해 <br /> 정밀한 필터링 조건으로 데이터셋을 구성합니다.
                  </p>

                  <ul className="space-y-3">
                    <li className="flex items-center gap-3 text-sm font-bold text-zinc-400">
                      <CheckCircle2 size={16} className="text-blue-500" /> 실시간 데이터 동기화
                    </li>
                    <li className="flex items-center gap-3 text-sm font-bold text-zinc-400">
                      <CheckCircle2 size={16} className="text-blue-500" /> 고급 키워드 분석 옵션
                    </li>
                  </ul>
                </div>

                <div className="mt-12 pt-6 border-t border-white/5 relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 bg-white/5 px-3 py-1 rounded-lg">Best for Precise Analysis</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Guide Info: 가독성 높은 하단 안내 */}
          <div className="bg-zinc-50 rounded-[2rem] p-8 flex flex-col md:flex-row items-center gap-6 border border-zinc-100 animate-in fade-in duration-1000 delay-500">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 shrink-0">
              <Info size={24} />
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-black text-zinc-900 mb-1">도움이 필요하신가요?</h3>
              <p className="text-sm text-zinc-500 font-medium">생성된 프로젝트는 언제든지 데이터 추가 및 관리가 가능하며, GPU 서버 자원은 프로젝트 삭제 시 즉시 해제됩니다.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}