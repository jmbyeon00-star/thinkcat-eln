"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Session } from "next-auth";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// ✅ UmapVisualization 컴포넌트 동적 import
const UmapVisualization = dynamic(
  () => import("@/components/patent/UmapVisualization"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="animate-spin h-6 w-6" />
          <span className="text-lg">UMAP 분석 로딩 중...</span>
        </div>
      </div>
    ),
  }
);

export default function CollectionAnalysisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codes = searchParams?.get('codes')?.split(',') || [];
  
  const { data: session } = useSession() as {
    data: (Session & { access_token?: string }) | null;
  };
  const token = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [collectionNames, setCollectionNames] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    async function fetchCollectionNames() {
      if (!token) {
        console.log("토큰 없음");
        return;
      }
      
      if (codes.length === 0) {
        console.log("codes 없음, 목록으로 이동");
        router.push('/collection');
        return;
      }

      try {
        setLoading(true);
        
        // ✅ 컬렉션 이름 매핑 생성 (각 컬렉션 정보 조회)
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";
        const nameMap: { [key: string]: string } = {};
        
        // 각 컬렉션 코드에 대한 이름 조회 (필요시)
        // 또는 codes를 그대로 사용
        codes.forEach((code, idx) => {
          nameMap[code] = code; // 기본적으로 코드를 이름으로 사용
        });
        
        setCollectionNames(nameMap);
        setLoading(false);
        
      } catch (error) {
        console.error("컬렉션 정보 로드 오류:", error);
        router.push('/collection');
      }
    }

    fetchCollectionNames();
  }, [codes.join(','), token, router]);

  // ✅ 닫기 핸들러
  const handleCloseAnalysis = () => {
    router.push('/collection');
  };

  // 로딩 중일 때는 로딩 스피너 표시
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="animate-spin h-6 w-6" />
          <span className="text-lg">분석 준비 중...</span>
        </div>
      </div>
    );
  }

  // ✅ UmapVisualization 컴포넌트 렌더링
  return (
    <UmapVisualization 
      collectionCodes={codes}
      collectionNames={collectionNames}
      onClose={handleCloseAnalysis}
    />
  );
}