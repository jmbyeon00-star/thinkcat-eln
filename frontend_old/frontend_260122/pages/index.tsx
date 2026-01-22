import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { SearchBar } from "@/components/search/SearchBar";
import BarChart from "@/components/charts/BarChart";
import ModelAccuracyLineChart from "@/components/charts/ModelAccuracyLineChart";
import { Sparkles, ArrowRight, BarChart3, LineChart as LineChartIcon, Zap, MousePointer2 } from "lucide-react";
import fs from "fs";
import path from "path";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    const messages = JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), "messages", `${locale || 'ko'}.json`),
            "utf-8"
        )
    );
    return { props: { messages } };
};

export default function Home() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
        if (!keyword.trim()) return;
        router.push(
            `/search/keyword/${encodeURIComponent(keyword)}?category=${category}&include_vector=false&include_quote=false`
        );
    };

    return (
        <>
            <Head>
                <title>IPFORCE | AI Patent Intelligence</title>
                <style>{`
                    html, body {
                        height: 100%;
                        margin: 0;
                        padding: 0;
                        overflow: hidden; /* 브라우저 기본 스크롤 차단 */
                    }

                    #main-snap-container {
                        height: 100vh;
                        overflow-y: auto;
                        scroll-snap-type: y mandatory;
                        scroll-behavior: smooth;

                        /* 🚀 스크롤바 숨기기 핵심 코드 */
                        -ms-overflow-style: none; /* IE, Edge */
                        scrollbar-width: none; /* Firefox */
                    }

                    /* Chrome, Safari, Opera, Brave */
                    #main-snap-container::-webkit-scrollbar {
                        display: none;
                    }

                    section {
                        height: 100vh;
                        width: 100%;
                        scroll-snap-align: start;
                        scroll-snap-stop: always;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        position: relative;
                    }
                `}</style>
            </Head>

            <main id="main-snap-container" className="bg-white selection:bg-blue-100">

                {/* SECTION 1: Hero & Search */}
                <section className="px-6 text-center">
                    {/* Background Decor */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none opacity-40">
                        <div className="absolute top-[10%] right-[10%] w-96 h-96 bg-blue-50 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[10%] left-[10%] w-72 h-72 bg-zinc-50 rounded-full blur-[100px]" />
                    </div>

                    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-zinc-900 leading-none">
                            IPFORCE<span className="text-blue-600">.</span>
                        </h1>

                        <p className="max-w-xl mx-auto text-lg md:text-xl text-zinc-400 font-medium leading-relaxed">
                            방대한 특허 데이터 속에서 숨겨진 가치를 찾으세요.
                            {/* <br className="hidden md:block" /> */}
                        </p>

                        <div className="pt-8 max-w-2xl mx-auto w-full">
                            <SearchBar loading={loading} onSearch={handleSearch} />
                        </div>
                    </div>

                    {/* Scroll Indicator */}
                    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-zinc-300 animate-bounce">
                        <span className="text-[10px] font-black uppercase tracking-widest">Scroll Down</span>
                        <MousePointer2 size={16} className="rotate-180" />
                    </div>
                </section>

                {/* SECTION 2: Analysis Insights (Charts) */}
                <section className="px-6 bg-zinc-50/30 border-t border-zinc-100">
                    <div className="max-w-7xl mx-auto w-full">
                        <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-blue-600">
                                    <Zap size={18} fill="currentColor" />
                                    <span className="text-xs font-black uppercase tracking-widest">Performance Benchmark</span>
                                </div>
                                <h2 className="text-4xl font-black tracking-tight text-zinc-900">
                                    지능형 특허 분류 성능
                                </h2>
                                <p className="text-zinc-500 font-medium max-w-lg">
                                    데이터 규모가 적은 환경에서도 IPFORCE의 알고리즘은 <br />일관되게 높은 정확도와 효율성을 유지합니다.
                                </p>
                            </div>
                            <div className="hidden md:block">
                                <button
                                    onClick={() => router.push('/about')}
                                    className="px-6 py-3 bg-white border border-zinc-200 rounded-2xl text-sm font-bold text-zinc-600 hover:shadow-lg transition-all flex items-center gap-2"
                                >
                                    서비스 소개 <ArrowRight size={16} />
                                </button>
                            </div>
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {mounted && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-zinc-200/40 border border-zinc-100 p-8 group transition-all hover:border-blue-200">
                                    <div className="flex items-center gap-2 mb-6 text-zinc-400 font-black text-[10px] uppercase tracking-widest">
                                        <BarChart3 size={14} /> Efficiency Gap
                                    </div>
                                    <BarChart />
                                </div>
                            )}
                            {mounted && (
                                <div className="bg-white rounded-[2.5rem] shadow-xl shadow-zinc-200/40 border border-zinc-100 p-8 group transition-all hover:border-blue-200">
                                    <div className="flex items-center gap-2 mb-6 text-zinc-400 font-black text-[10px] uppercase tracking-widest">
                                        <LineChartIcon size={14} /> Accuracy Curve
                                    </div>
                                    <ModelAccuracyLineChart />
                                </div>
                            )}
                        </div>

                        {/* Mobile view only button */}
                        <div className="mt-10 md:hidden text-center">
                            <button onClick={() => router.push('/about')} className="text-blue-600 font-bold text-sm">상세 기술서 보기 →</button>
                        </div>
                    </div>

                    {/* Footer mini in last section */}
                    <div className="absolute bottom-8 left-0 w-full text-center">
                        <p className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.4em]">© 2026 IPFORCE Intelligence Platform</p>
                    </div>
                </section>

            </main>
        </>
    );
}