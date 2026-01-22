"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// ✅ searchByRegistration import 추가
import { searchByRegistration } from "@/lib/api";

import PatentDetailInfo from "@/components/patent/PatentDetailInfo";
import PatentEvaluationResult from "@/components/patent/PatentEvaluationResult";
import ZipPredict from "@/components/patent/ZipPredict";
import PatLitigation from "@/components/patent/PatLitigation";
import PatNavigation from "@/components/patent/PatNavigation";
import PatentClaimInfo from "@/components/patent/PatClaim";

export default function RegistrationSearchPage() {
  const params = useParams();
  const regNo = decodeURIComponent(params?.registration as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!regNo) return;

    setLoading(true);
    setError(null);

    searchByRegistration(regNo)
      .then((result) => {
        setData(result);
        console.log(result);
      })
      .catch((err) => {
        console.error("Error fetching patent:", err);
        setError(err.message || "특허 정보를 불러오는데 실패했습니다.");
      })
      .finally(() => setLoading(false));
  }, [regNo]);

  // ✅ 로딩 상태 개선
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

  // ✅ 에러 상태 개선
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <svg 
              className="w-20 h-20 text-red-500 mx-auto" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-zinc-900 mb-2">
            오류가 발생했습니다
          </h3>
          <p className="text-red-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ✅ 데이터 없음 상태 개선
  if (!regNo || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <svg 
            className="w-20 h-20 text-zinc-300 mx-auto mb-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
            />
          </svg>
          <p className="text-zinc-500 text-lg">데이터를 찾을 수 없습니다</p>
          <p className="text-zinc-400 text-sm mt-2">
            등록번호: {regNo || "없음"}
          </p>
        </div>
      </div>
    );
  }

  // IPC 코드의 첫 번째 글자만 추출
  const firstLetter = data?.result?.ipc_code?.split("|")[0]?.trim()?.[0] || "";
  const appNo = data?.result?.application_number;

  return (
    <div className="mt-5 mb-10">
      <PatentDetailInfo data={data.result} loading={false} />
      <PatentClaimInfo data={data.result} loading={false} />
      <PatentEvaluationResult appNumber={appNo} />
      <ZipPredict applicationNumber={appNo} />
      <PatLitigation applicationNumber={appNo} />
      <PatNavigation applicationNumber={appNo} code={firstLetter} />
    </div>
  );
}