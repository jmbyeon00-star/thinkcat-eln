// frontend/pages/index.tsx
import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { SearchBar } from "@/components/search/SearchBar";
// import { SearchResults } from "@/components/search/SearchResults";
// import { SearchResp } from "@lib/types";
// import ModelAccuracyRadarChart from "@/components/charts/ModelAccuracyRadarChart";
// import BarChart from "@/components/charts/BarChart";
// import ModelAccuracyLineChart from "@/components/charts/ModelAccuracyLineChart";
// import { useSession } from "next-auth/react";
// import { useUserTaskStore } from '@/lib/store/useUserTaskStore'

import fs from "fs";
import path from "path";
import { GetServerSideProps } from "next";

export const getServerSideProps: GetServerSideProps = async ({ locale }) => {
    const messages = JSON.parse(
        fs.readFileSync(
            path.join(process.cwd(), "messages", `${locale}.json`),
            "utf-8"
        )
    );

    return {
        props: {
            messages,
        },
    };
};

export default function Home() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    // const [resp, setResp] = useState<SearchResp | null>(null);
    // const [page, setPage] = useState(1);
    // const [lastQuery, setLastQuery] = useState<{ keyword: string; category: string, page: number, size: number } | null>(null);
    // const size = 10;
    // const { isBusy, progress, status } = useUserTaskStore()

    const [lastQuery, setLastQuery] = useState<{
        keyword: string;
        category: string;
        page: number;
        size: number;
    } | null>(null);


    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    // ✅ 검색 시 결과 페이지로 이동
    const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
        if (!keyword.trim()) return;

        // 결과 페이지로 라우팅
        router.push(
            `/search/keyword/${encodeURIComponent(keyword)}?category=${category}&include_vector=false&include_quote=false`
        );
    };

    // const [hasSearched, setHasSearched] = useState(false);
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

                    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
                        <header className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
                                특허 자동 분류: 성능 비교
                            </h1>
                            <p className="mt-2 text-sm md:text-base text-zinc-500">
                                학습용 데이터가 부족할 수 있는 경우의 성능 비교
                            </p>
                        </header>

                        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {mounted && <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4">
                                <BarChart />
                            </div>}
                            {mounted && <div className="bg-white rounded-xl shadow-sm border border-zinc-100 p-4">
                                <ModelAccuracyLineChart />
                            </div>}
                        </div> */}
                    </section>
                </div>
            </section>
        </>
    );
}