"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { searchByApplication } from "@/lib/api";

// 컴포넌트 임포트 (파일 경로는 프로젝트 구조에 맞게 다시 확인해 주세요)
import PatentDetailInfo from "@/components/patent/PatDetailInfo";
import PatentClaimInfo from "@/components/patent/PatClaim";
import PatentEvaluationResult from "@/components/patent/PatEvaluationResult";
import ZipPredict from "@/components/patent/PatZipPredict";
import PatLitigation from "@/components/patent/PatLitigation";
import PatNavigation from "@/components/patent/PatNavigation";
import ApplicantNavigation from "@/components/patent/PatApplicantNavigation";
import AgentRecommendTable from "@/components/patent/PatAgentRecommend";

export default function ApplicationSearchDetail() {
  const params = useParams();
  const appNo = decodeURIComponent(params?.application as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appNo) return;
    setLoading(true);
    searchByApplication(appNo)
      .then((result) => setData(result))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [appNo]);

  if (loading) return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
  if (!data) return null;

  const result = data.result;
  const cpcfirstLetter = result?.cpc_code?.split("|")[0]?.trim()?.[0] || "";
  const filingDate = result?.filing_date || "";

  return (
    /* 중요: 이 부모 컨테이너가 너비를 딱 잡아줘야 안 퍼집니다! */
    <div className="min-h-screen bg-slate-50/30">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">


        {/* 나머지 컴포넌트들 */}
        <div className="space-y-10">
          <PatentDetailInfo data={result} />
          <PatentClaimInfo data={result} />
          <PatentEvaluationResult appNumber={appNo} />
          <ZipPredict applicationNumber={appNo} />
          <PatLitigation applicationNumber={appNo} />
          <PatNavigation applicationNumber={appNo} code={cpcfirstLetter} />
          <ApplicantNavigation
            applicationNumber={appNo}
            code={cpcfirstLetter}
            myPatentFilingDate={filingDate}
          />
          <AgentRecommendTable applicationNumber={appNo} code={cpcfirstLetter} />
        </div>

      </div>
    </div>
  );
}