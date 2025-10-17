"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import PatentDetailInfo from "@/components/patent/PatentDetailInfo";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatNavigation from "@/components/patent/PatNavigation";
import PatLitigation from "@/components/patent/PatLitigation";
import { CornerDownLeft } from "lucide-react";

import SearchLayout from "@/components/SearchLayout";

export default function SearchDetailPage() {
    const params = useParams();
    const searchParams = useSearchParams();

    // ✅ 안전하게 null 방어
    const appNum = params?.applicationNumber as string | undefined;
    const keyword = searchParams.get("keyword") || "#";

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!appNum) return; // ⚠️ params가 아직 준비되지 않으면 fetch 안 함
        // const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.1.20:8000";
        const base = "http://192.168.1.20:8000";
        fetch(`${base}/api/search/detail/${appNum}`)
        .then((res) => res.json())
        .then(setData)
        .finally(() => setLoading(false));
    }, [appNum, keyword]);

      if (!appNum)
        return <p className="text-center text-zinc-500 mt-10">경로를 불러오는 중...</p>;
    //   if (loading)
    //     return <p className="text-center text-zinc-500 mt-10">불러오는 중...</p>;
    if (!data)
        return <p className="text-center text-zinc-400 mt-10">데이터를 찾을 수 없습니다.</p>;

    console.log(data)

    return (
        <SearchLayout step={3} keyword={keyword}>
            <div className="mt-5 mb-10">
                <PatentDetailInfo data={data} />
                <PatentEvaluationResult appNumber={appNum} />
                <ZipPredict applicationNumber={appNum} />
                <PatLitigation applicationNumber={appNum} />
                <PatNavigation applicationNumber={appNum} code={data?.ipc_code?.split(" ")[0] || ""} />
            </div>
        </SearchLayout>
    );
    }
