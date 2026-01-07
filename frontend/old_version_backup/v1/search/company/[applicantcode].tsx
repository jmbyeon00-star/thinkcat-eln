import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { searchByApplicant } from "@/lib/api";
import CompanyInfo from "@/components/patent/PatCompanyInfo";  // ← 추가
import PatentTable from "@/components/patent/PatCompanyTable";

type CompanyData = {
    name: string;
    estb_dt: string;
    em_cnt: number;
    bzc_nm: string;
    age?: string;
};

type PatentItem = {
    application_number: string;
    applicant_name: string;
    ipc_code: string;
    end_status: string;
    filing_date: string;
};

type ApplicantResult = {
    result_1?: PatentItem[];
    result_2?: PatentItem[];
    result_3?: PatentItem[];
    company?: CompanyData;
};

export default function CompanyDetailPage() {
    const router = useRouter();
    const { applicantcode } = router.query;

    const [data, setData] = useState<ApplicantResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!router.isReady || !applicantcode) return;

        setLoading(true);
        setError(null);

        searchByApplicant(applicantcode as string)
            .then((response: any) => {
                console.log("받은 데이터:", response);  // ← 디버깅용 다시 활성화
                setData(response.result || response);
            })
            .catch((err) => {
                console.error("Error fetching company data:", err);
                setError("기업 정보를 불러오는데 실패했습니다.");
            })
            .finally(() => setLoading(false));
    }, [router.isReady, applicantcode]);

      // ✅ 로딩 상태 개선
    if (!router.isReady ||loading) {
        return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-zinc-600 text-lg font-medium">데이터를 불러오는 중...</p>
            </div>
        </div>
        );
    }


    if (error) {
        return (
            <div className="min-h-screen bg-zinc-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                        <p className="text-red-600 text-lg mb-4">{error}</p>
                        <button
                            onClick={() => router.reload()}
                            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                            다시 시도
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-zinc-50 p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-zinc-100 border border-zinc-200 rounded-xl p-8 text-center">
                        <p className="text-zinc-500 text-lg">데이터를 찾을 수 없습니다.</p>
                    </div>
                </div>
            </div>
        );
    }

    const result1: PatentItem[] = data.result_1 || [];
    const result2: PatentItem[] = data.result_2 || [];
    const result3: PatentItem[] = data.result_3 || [];

    return (
        <div className="min-h-screen bg-zinc-50 p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-zinc-900 mb-2">
                        기업 특허 분석
                    </h1>
                    <p className="text-zinc-600">
                        출원인 코드: <span className="font-mono font-semibold">{applicantcode}</span>
                    </p>
                </div>

                {/* ✅ Company Info 추가 */}
                {data.company && Object.keys(data.company).length > 0 && (
                    <CompanyInfo company={data.company} />
                )}

                {/* Patent Tables */}
                <div className="space-y-6 mt-8">
                    <PatentTable
                        title="출원특허를 최종특허로 보유"
                        description="출원하고 현재까지 보유 중인 특허"
                        data={result1}
                        color="blue"
                    />

                    <PatentTable
                        title="출원특허가 이전된 특허"
                        description="출원했지만 권리가 이전된 특허"
                        data={result2}
                        color="yellow"
                    />

                    <PatentTable
                        title="출원특허가 아닌 최종권리특허"
                        description="출원하지 않았지만 현재 보유 중인 특허"
                        data={result3}
                        color="green"
                    />
                </div>
            </div>
        </div>
    );
}