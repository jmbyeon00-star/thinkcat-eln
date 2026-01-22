// frontend/pages/search/detail/keyword/[keyword].tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { searchPagination } from "@lib/api";
import { SearchResults } from "@/components/search/SearchResults";
import { PaginationSearchResp } from "@lib/types";
import SearchLayout from "@components/layouts/SearchLayout";

export default function KeywordDetail() {
    const params = useParams();
    const searchParams = useSearchParams();
    const keyword = params?.keyword ? decodeURIComponent(params.keyword as string) : "";
    const category = searchParams.get("category") || "a";
    
    // ✅ URL에서 파라미터 가져오기
    const includeVector = searchParams.get("include_vector") === "true";
    const includeQuote = searchParams.get("include_quote") === "true";
    const searchMethod = searchParams.get("method") || "bgem3";

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [resp, setResp] = useState<PaginationSearchResp | null>(null);
    const size = 10;

    useEffect(() => {
        if (!keyword) return;
        setLoading(true);
        
        // ✅ searchPagination 사용
        searchPagination({ 
            section: category,
            keyword, 
            page, 
            page_size: size,
            method: searchMethod,
            include_vector: includeVector,  // URL에서 가져온 값
            include_quote: includeQuote,    // URL에서 가져온 값
        })
        .then((r) => setResp(r as PaginationSearchResp))
        .catch((e) => {
            console.error("검색 오류:", e);
            alert(e.message || "검색에 실패했습니다.");
        })
        .finally(() => setLoading(false));
    }, [keyword, category, page, searchMethod, includeVector, includeQuote]);
    
    return (
        <SearchLayout step={2}>
            <section className="mt-7">
                <h2 className="text-2xl font-bold text-blue-700 text-center mb-6">
                    "{keyword}" 검색 결과
                </h2>
                

                <SearchResults 
                    resp={resp} 
                    loading={loading} 
                    page={page} 
                    keyword={keyword} 
                    onChangePage={setPage} 
                />
            </section>
        </SearchLayout>
    );
}