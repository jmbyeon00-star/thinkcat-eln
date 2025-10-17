// frontend/pages/search/detail/keyword/[keyword].tsx
"use client";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { searchKeyword } from "@lib/api";
import { SearchResults } from "@/components/search/SearchResults";
import { SearchResp } from "@lib/types";
import SearchLayout from "@components/SearchLayout";

export default function KeywordDetail() {
    const params = useParams();
    const searchParams = useSearchParams();
    const keyword = params?.keyword ? decodeURIComponent(params.keyword as string) : "";
    const category = searchParams.get("category") || "a";

    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [resp, setResp] = useState<SearchResp | null>(null);
    const size = 10;

    useEffect(() => {
        if (!keyword) return;
        setLoading(true);
        searchKeyword({ keyword, category, page, size })
        .then((r) => setResp(r as SearchResp))
        .finally(() => setLoading(false));
    }, [keyword, category, page]);
    
    return (
        <SearchLayout step={2} >
            <section className="mt-7">
                <h2 className="text-2xl font-bold text-blue-700 text-center mb-6">
                    “{keyword}” 검색 결과
                </h2>
                <SearchResults resp={resp} loading={loading} page={page} keyword={keyword} onChangePage={setPage} />
            </section>
        </SearchLayout>
    );
}
