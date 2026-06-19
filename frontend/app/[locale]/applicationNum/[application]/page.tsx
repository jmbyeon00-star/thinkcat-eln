"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { searchByApplication } from "@/lib/api";
import { ArrowLeft } from "lucide-react";

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
  const router = useRouter(); // 👈 이 줄 추가
  const appNo = decodeURIComponent(params?.application as string);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appNo) return;
    setLoading(true);
    window.scrollTo(0, 0); // 이전 페이지(검색결과 등)의 스크롤 위치가 그대로 남아있는 문제 방지
    searchByApplication(appNo)
      .then((result) => setData(result))
      .catch((err) => console.error("Error:", err))
      .finally(() => setLoading(false));
  }, [appNo]);

  if (loading) return (
    <div className="flex flex-col justify-center items-center min-h-screen gap-4">
      <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-slate-400 font-bold">특허 상세 정보를 불러오는 중...</p>
    </div>
  );
  
  if (!data) return (
    <div className="flex justify-center items-center min-h-screen text-slate-400 font-bold">
      데이터를 찾을 수 없습니다.
    </div>
  );

  const result = data.result;
  const cpcfirstLetter = result?.cpc_code?.split("|")[0]?.trim()?.[0] || "";
  const filingDate = result?.filing_date || "";

  return (
    <div className="min-h-screen bg-slate-50/30">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8 text-left">
        
        {/* 🎯 이전으로 돌아가기 버튼 (상단 배치) */}
        <div className="flex items-center justify-start">
          <button 
            onClick={() => router.back()}
            className="group flex items-center gap-3 px-4 py-2 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-200 transition-all active:scale-95"
          >
            <div className="p-1.5 rounded-full bg-slate-50 group-hover:bg-blue-50 text-slate-400 group-hover:text-blue-600 transition-colors">
              <ArrowLeft size={18} strokeWidth={3} />
            </div>
            <span className="text-sm font-black text-slate-600 group-hover:text-blue-700">이전 결과로 돌아가기</span>
          </button>
        </div>

        <div className="space-y-10">
          <PatentDetailInfo data={result} />
          <PatentClaimInfo data={result} />
          <PatentEvaluationResult appNumber={appNo as string} />
          <ZipPredict applicationNumber={appNo as string} />
          <PatLitigation applicationNumber={appNo as string} />
          <PatNavigation applicationNumber={appNo as string} code={cpcfirstLetter}/>
          <ApplicantNavigation 
            applicationNumber={appNo as string} 
            code={cpcfirstLetter} 
            myPatentFilingDate={filingDate} 
          />
          <AgentRecommendTable applicationNumber={appNo as string} code={cpcfirstLetter} />
        </div>
      </div>
    </div>
  );
}