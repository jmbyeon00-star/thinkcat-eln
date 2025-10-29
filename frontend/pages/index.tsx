// frontend/pages/index.tsx
"use client";

import React, { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchResp } from "@lib/types";
import ModelAccuracyRadarChart from "@/components/charts/ModelAccuracyRadarChart";
import BarChart from "@/components/charts/BarChart";
import ModelAccuracyLineChart from "@/components/charts/ModelAccuracyLineChart";
import { useSession } from "next-auth/react";

import { useUserTaskStore } from '@/lib/store/useUserTaskStore'

export default function Home() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [resp, setResp] = useState<SearchResp | null>(null);
    const [page, setPage] = useState(1);
    const [lastQuery, setLastQuery] = useState<{ keyword: string; category: string, page: number, size: number } | null>(null);
    const size = 10;

    const { isBusy, progress, status } = useUserTaskStore()

    // ✅ 검색 시 결과 페이지로 이동
    const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
        if (!keyword.trim()) return;
        
        // 결과 페이지로 라우팅
        router.push(
            `/search/keyword/${encodeURIComponent(keyword)}?category=${category}&include_vector=false&include_quote=false`
        );
    };

    const [hasSearched, setHasSearched] = useState(false);
    return (
        <>
            <Head>
                <title>IPFORCE 메인</title>
                <meta name="description" content="IPFORCE 프로젝트 메인 페이지" />
            </Head>

            <section className="py-16 text-center">
                <h1 className="text-4xl font-bold">
                    Welcome to <span className="text-blue-700">IPFORCE</span>
                </h1>
                <p className="mt-3 text-gray-600">
                    AI 기반 R&D, Product, Service 솔루션을 제공합니다.
                </p>

                <div className="mt-10">
                    <SearchBar loading={loading} onSearch={handleSearch} />
                    {/* <ModelAccuracyRadarChart /> */}
                    
                    <section className="ml-10 m-10 mx-auto bg-white p-8 rounded-xl border border-zinc-200 shadow-sm mt-10">
                        {/* <h1 className="text-xl font-semibold text-zinc-900 mb-6 border-b border-zinc-200 pb-3">
                            아이피포스 소개
                        </h1> */}
                        <header>
                            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                                특허 자동 분류: 성능 분류
                            </h1>
                            <p className="mt-2 text-sm md:text-base text-zinc-500">
                                학습용 데이터가 부족할 수 있는 경우의 성능 비교<br/>
                            </p>
                        </header>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-20 pr-20 pt-10 ">
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <BarChart />
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm">
                                <ModelAccuracyLineChart />
                            </div>
                        </div>
                    </section>
                </div>
            </section>
        </>
    );
}
