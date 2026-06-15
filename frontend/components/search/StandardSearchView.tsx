'use client';

import React, { useState, useEffect, useRef } from "react";
import { Search, Hash, FileCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { StandardSearchBar } from "@/components/search/StandardSearchBar";
import { searchNeo4jVector, searchByApplication, searchByRegistration } from "@lib/api";
import { PaginationSearchResp } from "@lib/types";
import { SearchOptions, SearchResultItem } from "@/types/search";

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
    setResults: (r: any[]) => void;
    totalHits: number;
    setTotalHits: (n: number) => void;
    setHasSearched: (b: boolean) => void;
    hasSearched: boolean;
    setSearchMode: (m: 'chat' | 'keyword') => void;
    keywordCache: Record<string, PaginationSearchResp>;
    setKeywordCache: (key: string, data: any) => void;
    pageSize: number;
    keywordQuery?: string;
    applicationQuery?: string;
    registrationQuery?: string;
}

export const StandardSearchView = (props: StandardProps) => {
    const translator = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const getInitialType = (): "keyword" | "application" | "registration" => {
        const t = searchParams.get("type");
        if (t === "application" || t === "registration" || t === "keyword") return t;
        return props.searchType;
    };

    const [localSearchType, setLocalSearchType] = useState<"keyword" | "application" | "registration">(getInitialType);
    const [localKeyword, setLocalKeyword] = useState(props.keywordQuery ?? "");
    const [localApplication, setLocalApplication] = useState(props.applicationQuery ?? "");
    const [localRegistration, setLocalRegistration] = useState(props.registrationQuery ?? "");
    const isSwitchingTab = useRef(false);

    const currentInputValue =
        localSearchType === "keyword"     ? localKeyword
      : localSearchType === "application" ? localApplication
      :                                     localRegistration;

    const handleApiResponse = (apiResponse: any, cacheKey: string, shouldCache: boolean, type: string) => {
        let finalResults: any[] = [];
        let totalHits = 0;

        if (type === "keyword") {
            if (apiResponse?.data) {
                finalResults = apiResponse.data.map((item: any) => ({ _source: item }));
                totalHits = apiResponse.meta?.total_count || 0;
            }
        } else {
            if (apiResponse?.result) {
                    const result = apiResponse.result;
                    finalResults = [{ 
                        _source: {
                            ...result,
                            // ✅ API 오타 대응: end_stauts → end_status로 정규화
                            end_status: result.end_status ?? result.end_stauts,
                        }
                    }];
                    totalHits = 1;
            }
        }

        props.setResults(finalResults);
        props.setTotalHits(totalHits);
        if (shouldCache) props.setKeywordCache(cacheKey, apiResponse);
    };

    const performSearch = async (
        type: "keyword" | "application" | "registration",
        keyword: string,
        page: number = 1,
        category: string = "all"
    ) => {
        const trimmed = keyword.trim();
        if (!trimmed) return;

        props.setHasSearched(true);
        props.setIsLoading(true);
        props.setSearchMode("keyword");

        const cacheKey = `std_${type}_${trimmed}_${category}_${page}`;

        if (props.keywordCache[cacheKey]) {
            handleApiResponse(props.keywordCache[cacheKey], cacheKey, false, type);
            props.setIsLoading(false);
            return;
        }

        try {
            const apiResponse =
                type === "keyword"
                    ? await searchNeo4jVector({
                          keyword: trimmed,
                          section: category === "all" ? null : category.toUpperCase(),
                          page,
                          page_size: props.pageSize,
                      })
                    : type === "application"
                        ? await searchByApplication(trimmed)
                        : await searchByRegistration(trimmed);

            handleApiResponse(apiResponse, cacheKey, true, type);
        } catch (error) {
            console.error("Standard Search Error:", error);
            props.setResults([]);
            props.setTotalHits(0);
        } finally {
            props.setIsLoading(false);
        }
    };

    const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
        if (localSearchType === "keyword") setLocalKeyword(keyword);
        else if (localSearchType === "application") setLocalApplication(keyword);
        else setLocalRegistration(keyword);

        props.setSearchType(localSearchType);
        props.setQuery(keyword);
        props.setCurrentPage(1);
        props.setOptions((prev: any) => ({ ...prev, filters: { ...prev.filters, category } }));

        const params = new URLSearchParams({ q: keyword, cat: category, type: localSearchType, page: "1" });
        router.push(`${pathname}?${params.toString()}`);

        performSearch(localSearchType, keyword, 1, category);
    };

    useEffect(() => {
        if (isSwitchingTab.current) {
            isSwitchingTab.current = false;
            return;
        }

        const resolvedType = (searchParams.get("type") || "keyword") as "keyword" | "application" | "registration";
        const resolvedQ = searchParams.get("q") || "";
        const cat = searchParams.get("cat") || "all";
        const page = searchParams.get("page") || "1";

        setLocalSearchType(resolvedType);
        props.setSearchType(resolvedType);

        if (resolvedQ) {
            if (resolvedType === "keyword") setLocalKeyword(resolvedQ);
            else if (resolvedType === "application") setLocalApplication(resolvedQ);
            else setLocalRegistration(resolvedQ);

            performSearch(resolvedType, resolvedQ, parseInt(page), cat);
        }
    }, [searchParams]);

    useEffect(() => {
        if (!props.hasSearched || localSearchType !== "keyword") return;
        performSearch(localSearchType, localKeyword, props.currentPage, (props.options.filters as any)?.category || "all");
    }, [props.currentPage]);

    const onTabClick = (newType: "keyword" | "application" | "registration") => {
        if (localSearchType === newType) return;
        isSwitchingTab.current = true;
        setLocalSearchType(newType);
        props.setSearchType(newType);
        router.push(`${pathname}?type=${newType}`);
    };

    const typeOptions = [
        { id: "keyword",      label: translator("search.standard.tabs.keyword"),      icon: <Search size={14} /> },
        { id: "application",  label: translator("search.standard.tabs.application"),  icon: <Hash size={14} /> },
        { id: "registration", label: translator("search.standard.tabs.registration"), icon: <FileCheck size={14} /> },
    ];

    return (
        <div className="w-full bg-white">
            <div className="w-full max-w-5xl mx-auto space-y-10 py-4 md:py-6 px-6">

                {/* 헤더 */}
                <div className="text-center mb-8 animate-in fade-in zoom-in duration-1000">
                    <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-5 leading-tight">
                        어떤 특허를 <span className="text-blue-600">찾으시나요?</span>
                    </h1>
                    <p className="text-slate-500 text-lg font-medium">
                        방대한 특허 빅데이터를 실시간으로 분석해 가장 정밀한 결과를 제공합니다.
                    </p>
                    <p className="mt-3 text-sm font-semibold text-blue-500/80 tracking-wide transition-all duration-300">
                        {localSearchType === "keyword"      && "💡 기술 키워드와 CPC 분류를 조합해 의미적으로 유사한 특허를 탐색합니다."}
                        {localSearchType === "application"  && "💡 출원번호를 입력하면 해당 특허의 상세 정보를 조회합니다."}
                        {localSearchType === "registration" && "💡 등록번호를 입력하면 해당 특허의 상세 정보를 조회합니다."}
                    </p>
                </div>

                {/* 탭 선택 */}
                <div className="flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
                    <div className="inline-flex bg-zinc-50 p-1.5 rounded-[1.5rem] border border-zinc-100 shadow-inner">
                        {typeOptions.map((opt) => (
                            <button
                                key={opt.id}
                                onClick={() => onTabClick(opt.id as any)}
                                className={`
                                    flex items-center gap-2 px-8 py-3 rounded-2xl text-sm font-black transition-all duration-300
                                    ${localSearchType === opt.id
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

                {/* 검색 카드 */}
                <div className="relative group animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                    <div className="absolute -inset-4 bg-gradient-to-r from-blue-600/5 to-indigo-600/5 rounded-[3.5rem] opacity-0 group-focus-within:opacity-100 transition-opacity blur-2xl" />

                    <div className="relative bg-white rounded-[3rem] shadow-2xl shadow-zinc-200/60 border border-zinc-100 p-4 md:p-8 transition-all duration-500 group-focus-within:border-blue-200">
                        <StandardSearchBar
                            key={localSearchType}
                            loading={props.isLoading}
                            searchType={localSearchType}
                            onSearch={handleSearch}
                            initialKeyword={currentInputValue}
                            initialCategory={(props.options.filters as any)?.category || "all"}
                        />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default StandardSearchView;