// import { useParams } from "next/navigation"; // app router
import { useRouter } from "next/router"; // page route
import { useEffect, useState } from "react";

import { searchByApplication } from "@/lib/api";
import PatentDetailInfo from "@/components/patent/PatentDetailInfo";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatLitigation from "@/components/patent/PatLitigation";
import PatNavigation from "@/components/patent/PatNavigation";
import PatentClaimInfo from "@/components/patent/PatClaim";

import { withMessages } from '@/lib/i18n/withMessages';
import SearchLayout from "@/components/layouts/SearchLayout";
export const getServerSideProps = withMessages();

export default function ApplicationSearchDetail() {
  // app router
  // const params = useParams();
  // const appNo = decodeURIComponent(params?.application as string);

  // page router
  const router = useRouter();
  const { application } = router.query;
  const appNo =
    typeof application === "string"
      ? decodeURIComponent(application)
      : undefined;
  if (!appNo) {
    return null; // 또는 로딩 UI
  }

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady || !appNo) return;

    setLoading(true);
    setError(null);

    searchByApplication(appNo)
      .then((result) => {
        setData(result);
      })
      .catch((err) => {
        console.error("Error fetching patent:", err);
        setError("특허 정보를 불러오는데 실패했습니다.");
      })
      .finally(() => setLoading(false));
  }, [router.isReady, appNo]);

  if (!router.isReady || loading) {
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
      <p className="text-center text-red-500 mt-10">
        {error}
      </p>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-zinc-400 mt-10">
        데이터가 없습니다.
      </p>
    );
  }

  // IPC 코드의 첫 번째 글자만 추출 (컴포넌트 본문에서 계산)
  const firstLetter =
    data?.result?.ipc_code?.split("|")[0]?.trim()?.[0] || "";

  return (
    <SearchLayout>
      <div className="mt-5 mb-10">
        <PatentDetailInfo data={data.result} />
        <PatentClaimInfo data={data.result} />
        <PatentEvaluationResult appNumber={appNo} />
        <ZipPredict applicationNumber={appNo} />
        <PatLitigation applicationNumber={appNo} />
        <PatNavigation applicationNumber={appNo} code={firstLetter} />
      </div>
    </SearchLayout>
  );
}