// frontend/pages/search/detail/keyword/[keyword].tsx

import { useEffect, useState } from "react";
// import { useParams, useSearchParams } from "next/navigation"; // app router
import { useRouter } from "next/router"; // page router

import { searchPagination } from "@lib/api";
import { SearchResults } from "@/components/search/SearchResults";
import { PaginationSearchResp } from "@lib/types";
import SearchLayout from "@components/layouts/SearchLayout";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export default function KeywordDetail() {
    // app router
    // const params = useParams();
    // const searchParams = useSearchParams();
    // const keyword = params?.keyword ? decodeURIComponent(params.keyword as string) : "";
    // const category = searchParams.get("category") || "a";
    // URL에서 파라미터 가져오기
    // const includeVector = searchParams.get("include_vector") === "true";
    // const includeQuote = searchParams.get("include_quote") === "true";
    // const searchMethod = searchParams.get("method") || "bgem3";

    // page router
    const router = useRouter();
    const {
        keyword: rawKeyword,
        category: rawCategory,
        include_vector,
        include_quote,
        method,
    } = router.query;
    // keyword (path param)
    const keyword =
        typeof rawKeyword === "string"
            ? decodeURIComponent(rawKeyword)
            : "";
    // query params
    const category =
        typeof rawCategory === "string" ? rawCategory : "a";
    const includeVector = include_vector === "true";
    const includeQuote = include_quote === "true";
    const searchMethod =
        typeof method === "string" ? method : "bgem3";

    const [page, setPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [resp, setResp] = useState<PaginationSearchResp | null>(null);

    const size = 10;

    useEffect(() => {
        if (!router.isReady || !keyword) return;

        setIsLoading(true);

        // searchPagination 사용
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
            .finally(() => setIsLoading(false));
    }, [
        router.isReady,
        keyword,
        category,
        page,
        searchMethod,
        includeVector,
        includeQuote,
    ]);

    return (
        <SearchLayout step={2}>
            <section className="mt-7">
                <h2 className="text-2xl font-bold text-blue-700 text-center mb-6">
                    "{keyword}" 검색 결과
                </h2>


                <SearchResults
                    resp={resp}
                    loading={isLoading}
                    page={page}
                    keyword={keyword}
                    onChangePage={setPage}
                />
            </section>
        </SearchLayout>
    );
}