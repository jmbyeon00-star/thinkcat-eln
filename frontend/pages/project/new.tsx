"use client"; 

import Head from "next/head";
import Link from "next/link";
import { Database, UploadCloud, ArrowRight } from "lucide-react";

export default function NewProjectIndex() {
  return (
    <>
      <Head>
        <title>새 프로젝트 만들기 | IPFORCE</title>
        <meta name="robots" content="noindex" />
      </Head>
      
      <div className="min-h-screen bg-white">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              <h1 className="text-4xl font-bold text-zinc-900">
                새 프로젝트 생성
              </h1>
            </div>
            <p className="text-lg text-zinc-600">
              원하시는 방식을 선택하여 프로젝트를 시작하세요
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* File Upload Card */}
            <Link href="/project/upload" legacyBehavior>
              <a className="group block">
                <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer">
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-xl p-2.5">
                        <UploadCloud className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-xl font-semibold text-white">
                        파일 업로드
                      </h2>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <p className="text-zinc-600 leading-relaxed mb-6">
                      CSV, Excel 등 로컬 파일을 업로드하여 프로젝트를 생성합니다. 
                      대용량 데이터도 빠르게 처리할 수 있습니다.
                    </p>

                    {/* Features */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">CSV, XLSX, XLS 파일 지원</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">즉시 데이터 분석 가능</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">대용량 파일 처리 지원</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 py-4 bg-blue-50 border-t border-blue-100">
                    <p className="text-xs text-blue-800 flex items-center gap-1">
                      <span className="font-semibold">추천:</span>
                      빠른 시작을 원하시는 경우
                    </p>
                  </div>
                </div>
              </a>
            </Link>

            {/* DB Search Card */}
            <Link href="/project/search" legacyBehavior>
              <a className="group block">
                <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 cursor-pointer">
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-white/20 rounded-xl p-2.5">
                        <Database className="w-6 h-6 text-white" />
                      </div>
                      <h2 className="text-xl font-semibold text-white">
                        DB 검색
                      </h2>
                    </div>
                    <ArrowRight className="w-5 h-5 text-white/80 group-hover:translate-x-1 transition-transform" />
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <p className="text-zinc-600 leading-relaxed mb-6">
                      사내 데이터베이스나 인덱스 DB에서 조건을 설정하여 검색한 후 
                      프로젝트를 생성합니다.
                    </p>

                    {/* Features */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">고급 필터링 옵션</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">실시간 데이터 동기화</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <div className="w-5 h-5 rounded-full bg-cyan-100 flex items-center justify-center mt-0.5 flex-shrink-0">
                          <svg className="w-3 h-3 text-cyan-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                        <span className="text-sm text-zinc-700">복잡한 쿼리 지원</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-6 py-4 bg-cyan-50 border-t border-cyan-100">
                    <p className="text-xs text-cyan-800 flex items-center gap-1">
                      <span className="font-semibold">추천:</span>
                      정밀한 데이터 선택이 필요한 경우
                    </p>
                  </div>
                </div>
              </a>
            </Link>
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-zinc-50 to-blue-50 border border-zinc-200 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-500 text-white rounded-full p-2 mt-0.5">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-2">
                  프로젝트 생성 안내
                </h3>
                <ul className="text-sm text-zinc-700 space-y-1">
                  <li>• 파일 업로드: 간편하고 빠르게 데이터를 가져올 수 있습니다</li>
                  <li>• DB 검색: 세밀한 조건으로 필요한 데이터만 선택할 수 있습니다</li>
                  <li>• 생성된 프로젝트는 언제든지 수정하고 관리할 수 있습니다</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}