'use client';

import React, { useState, useEffect, useRef } from "react";
import { Search, Hash, FileCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { StandardSearchBar } from "@/components/search/StandardSearchBar";
import { searchPagination, searchByApplication, searchByRegistration } from "@lib/api";
import { PaginationSearchResp } from "@lib/types";
import { SearchOptions, SearchResultItem } from '@/types/search';

// interface StandardProps {
//     setIsLoading: (b: boolean) => void;
//     setResults: (r: any[]) => void;
//     setTotalHits: (n: number) => void;
//     setHasSearched: (b: boolean) => void;
// }
interface StandardProps {
    searchType: "keyword" | "application" | "registration";
    setSearchType: (t: "keyword" | "application" | "registration") => void;
    query: string;
    setQuery: (q: string) => void;
    options: SearchOptions;
    setOptions: React.Dispatch<React.SetStateAction<SearchOptions>>;
    currentPage: number;
    setCurrentPage: (p: number) => void;
    isLoading: boolean;
    setIsLoading: (b: boolean) => void;
    results: SearchResultItem[];
    setResults: (r: SearchResultItem[]) => void;
    setTotalHits: (n: number) => void;
    setHasSearched: (b: boolean) => void;
    hasSearched: boolean;
    setSearchMode: (m: 'chat' | 'keyword') => void;
    keywordCache: Record<string, PaginationSearchResp>;
    setKeywordCache: (key: string, data: PaginationSearchResp) => void;
    pageSize: number;
}

export const StandardSearchView = (props: StandardProps) => {
    const translator = useTranslations();
    const isFirstMount = useRef(true);

    const performSearch = async (page: number = 1, category: string = "a", overrideKeyword?: string) => {
        const currentKeyword = (overrideKeyword || props.query).trim();
        if (!currentKeyword) return;


        // 캐시 키 생성 (검색타입 + 키워드 + 페이지 + 검색엔진)
        const method = props.options.search_type || "bgem3";
        const cacheKey = `std_${props.searchType}_${currentKeyword}_${category}_${page}_${method}`;

        // 캐시 체크 (Context 금고 뒤지기)
        if (props.keywordCache[cacheKey]) {
            const cachedData = props.keywordCache[cacheKey] as any;
            let normalized: any[] = [];

            if (props.searchType === "keyword") {
                normalized = (cachedData.data || []).map((item: any, index: number) => ({
                    _source: { ...item, score: cachedData.hits?.[index]?.score, end_status: item.grant_date ? "등록" : "출원" }
                }));
            } else if (cachedData.result) {
                normalized = [{
                    _source: { ...cachedData.result, end_status: cachedData.result.grant_date ? "등록" : "출원" }
                }];
            }

            props.setResults(normalized);
            props.setTotalHits(props.searchType === "keyword" ? (cachedData.total_hits || 0) : 1);
            props.setHasSearched(true);
            return;
        }

        // 서버 요청 시작
        props.setIsLoading(true);
        props.setHasSearched(true);
        props.setSearchMode("keyword");

        try {
            let finalResults: any[] = [];
            let totalHits = 0;
            let apiResponse: any = null;

            if (props.searchType === "keyword") {
                // 1. 키워드 검색 (기존 로직)
                apiResponse = await searchPagination({
                    section: category,
                    keyword: currentKeyword,
                    page: page,
                    page_size: props.pageSize,
                    method: method,
                    include_vector: props.options.use_vector,
                });

                if (apiResponse && apiResponse.data) {
                    finalResults = apiResponse.data.map((item: any, index: number) => ({
                        _source: {
                            ...item,
                            score: apiResponse.hits?.[index]?.score,
                            end_status: item.grant_date ? "등록" : "출원"
                        }
                    }));
                    totalHits = apiResponse.total_hits || 0;
                }

            } else {
                // 2. 출원번호 또는 등록번호 검색 (단일 건)
                apiResponse = props.searchType === "application"
                    ? await searchByApplication(currentKeyword)
                    : await searchByRegistration(currentKeyword);

                console.log("번호 검색 원본 응답:", apiResponse);

                if (apiResponse && apiResponse.result) {
                    finalResults = [{
                        _source: {
                            ...apiResponse.result,
                            end_status: apiResponse.result.grant_date ? "등록" : "출원"
                        }
                    }];
                    totalHits = 1;
                }
            }
            // 글로벌 상태 업데이트
            props.setResults(finalResults);
            props.setTotalHits(totalHits);
            props.setKeywordCache(cacheKey, apiResponse);

        } catch (error) {
            console.error("Standard Search Error:", error);
            props.setResults([]);
            props.setTotalHits(0);
        } finally {
            props.setIsLoading(false);
        }
    };

    const handleSearch = ({ keyword, category }: { keyword: string, category: string }) => {
        isFirstMount.current = false; // 수동 검색 시 방어막 해제
        props.setQuery(keyword);
        props.setOptions((prev: any) => ({ ...prev, filters: { ...prev.filters, category } }));
        props.setCurrentPage(1);
        performSearch(1, category, keyword);
    };

    useEffect(() => {
        if (!props.hasSearched) return;

        if (isFirstMount.current && props.results.length > 0) {
            isFirstMount.current = false;
            return;
        }
        if (props.searchType === "keyword") {
            performSearch(props.currentPage);
        }

        isFirstMount.current = false;
    }, [props.currentPage]);

    const typeOptions = [
        { id: "keyword", label: translator("search.standard.tabs.keyword"), icon: <Search size={14} /> },
        { id: "application", label: translator("search.standard.tabs.application"), icon: <Hash size={14} /> },
        { id: "registration", label: translator("search.standard.tabs.registration"), icon: <FileCheck size={14} /> },
    ];

    return (
        <div className="w-full max-w-5xl mx-auto space-y-12 py-10">
            {/* 상단 타입 선택 탭 */}
            <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex bg-zinc-50 p-1.5 rounded-[1.5rem] border border-zinc-100 shadow-inner">
                    {typeOptions.map((opt) => (
                        <button
                            key={opt.id}
                            onClick={() => {
                                props.setSearchType(opt.id as any)
                                isFirstMount.current = false;
                            }}
                            className={`
                                flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300
                                ${props.searchType === opt.id
                                    ? "bg-white text-blue-600 shadow-lg ring-1 ring-zinc-200/50 scale-105"
                                    : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/50"}
                            `}
                        >
                            {opt.icon}
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 검색바 (기존 SearchBar 컴포넌트 활용) */}
            <div className="relative bg-white rounded-[3rem] shadow-2xl p-6 border border-zinc-100">
                <StandardSearchBar
                    loading={props.isLoading}
                    searchType={props.searchType}
                    onSearch={handleSearch}
                />
            </div>
        </div>
    );
};