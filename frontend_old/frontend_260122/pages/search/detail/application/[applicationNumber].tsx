import { useEffect, useState } from "react";
// import { useParams, useSearchParams } from "next/navigation"; // app router
import { useRouter } from "next/router"; // page router

import PatentDetailInfo from "@/components/patent/PatentDetailInfo";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatNavigation from "@/components/patent/PatNavigation";
import PatLitigation from "@/components/patent/PatLitigation";
import SearchLayout from "@/components/layouts/SearchLayout";
import { getQueryString } from "@/utils/common";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

export default function SearchDetailPage() {
    // app router
    // const params = useParams();
    // const searchParams = useSearchParams();
    // 안전하게 null 방어
    // const appNum = params?.applicationNumber as string | undefined;
    // const keyword = searchParams.get("keyword") || "#";

    // page router
    const router = useRouter();
    const { applicationNumber, keyword: rawKeyword } = router.query;
    const appNum = getQueryString(applicationNumber)
    if (!appNum) { return null; }

    const keyword =
        typeof rawKeyword === "string" && rawKeyword.length > 0
            ? rawKeyword
            : "#";

    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!router.isReady || !appNum) return;

        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

        setIsLoading(true);

        fetch(`${API_BASE}/api/search/detail/${appNum}`)
            .then((res) => res.json())
            .then(setData)
            .finally(() => setIsLoading(false));
    }, [router.isReady, appNum, keyword]);

    if (!router.isReady || isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-zinc-600 text-lg font-medium">데이터를 불러오는 중...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <p className="text-center text-zinc-400 mt-10">
                데이터を 찾을 수 없습니다.
            </p>
        );
    }


    return (
        <SearchLayout step={3} keyword={keyword}>
            <div className="mt-5 mb-10">
                <PatentDetailInfo data={data} />
                <PatentEvaluationResult appNumber={appNum} />
                <ZipPredict applicationNumber={appNum} />
                <PatLitigation applicationNumber={appNum} />
                <PatNavigation
                    applicationNumber={appNum}
                    code={data?.ipc_code?.split(" ")[0] || ""} />
            </div>
        </SearchLayout>
    );
}
