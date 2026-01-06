import { useEffect, useState } from "react";
// import { useParams } from "next/navigation"; // app router
import { useRouter } from "next/router"; // page router

import SearchLayout from "@/components/layouts/SearchLayout";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatNavigation from "@/components/patent/PatNavigation";
import PatLitigation from "@/components/patent/PatLitigation";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

/**
 * 등록번호 상세 페이지
 * 예시 URL: /search/detail/1012345678900
 */
export default function RegisterNumberDetailPage() {
  // app router
  // const params = useParams();
  // const registerNumber = params?.registerNumber as string | undefined;

  // page router
  const router = useRouter();
  const { registerNumber } = router.query;
  const regNo =
    typeof registerNumber === "string"
      ? decodeURIComponent(registerNumber)
      : null;

  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady || !regNo) return;

    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://192.168.1.20:8000";

    setIsLoading(true);
    fetch(`${base}/api/search/reg/${registerNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error("등록번호 조회 실패");
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        console.error("❌ 등록번호 상세 조회 오류:", err);
        setData(null);
      })
      .finally(() => setIsLoading(false));
  }, [router.isReady, regNo]);

  if (!router.isReady) {
    return (
      <p className="text-center text-zinc-500 mt-10">
        경로를 불러오는 중...
      </p>
    );
  }
  if (isLoading) {
    return (
      <p className="text-center text-zinc-500 mt-10">
        데이터 불러오는 중...
      </p>
    );
  }
  if (!data) {
    return (
      <p className="text-center text-zinc-400 mt-10">
        등록번호 {regNo} 에 대한 데이터를 찾을 수 없습니다.
      </p>
    );
  }

  return (
    <SearchLayout step={3} keyword={"#등록번호"}>
      <div className="mt-5 mb-10 space-y-8">
        {/* 특허 평가 */}
        <PatentEvaluationResult appNumber={data?.application_number} />

        {/* 피인용수 예측 */}
        <ZipPredict applicationNumber={data?.application_number} />

        {/* 특허 네비게이션 */}
        <PatNavigation
          applicationNumber={data?.application_number}
          code={data?.ipc_code?.split(" ")[0] || ""}
        />

        {/* 권리자 이전정보 */}
        <PatLitigation applicationNumber={data?.application_number} />
      </div>
    </SearchLayout>
  );
}
