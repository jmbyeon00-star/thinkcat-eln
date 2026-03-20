"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { searchByApplication } from "@/lib/api";
import PatentDetailInfo from "@/components/patent/PatentDetailInfo";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatLitigation from "@/components/patent/PatLitigation";
import PatNavigation from "@/components/patent/PatNavigation";
import PatentClaimInfo from "@/components/patent/PatClaim";
import ApplicantNavigation from "@/components/patent/ApplicantNavigation_ver2";
import AgentNavigation from "@/components/patent/AgentRecommend";

export default function ApplicationSearchDetail() {
  const params = useParams();
  const application = params?.application;

  const appNo =
    typeof application === "string"
      ? decodeURIComponent(application)
      : undefined;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appNo) return;

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
  }, [appNo]);

  if (loading) {
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

  // IPC/CPC 코드 추출
  const ipcfirstLetter = data?.result?.ipc_code?.split("|")[0]?.trim()?.[0] || "";
  const cpcfirstLetter = data?.result?.cpc_code?.split("|")[0]?.trim()?.[0] || "";
  const filingDate = data?.result?.filing_date || "";

  if (!appNo) {
    return <div>Application number not found</div>;
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <PatentDetailInfo data={data.result} />
      <PatentClaimInfo data={data.result} />
      <PatentEvaluationResult appNumber={appNo} />
      <ZipPredict applicationNumber={appNo} />
      <PatLitigation applicationNumber={appNo} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PatNavigation applicationNumber={appNo} code={ipcfirstLetter} />
        <ApplicantNavigation
          applicationNumber={appNo}
          code={cpcfirstLetter}
          myPatentFilingDate={filingDate}
        />
      </div>
      <AgentNavigation applicationNumber={appNo} code={cpcfirstLetter} />
    </div>
  );
}