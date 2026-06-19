"use client";
import { useParams } from "next/navigation";
import { useRouter } from "@/routing";
import { useEffect, useState } from "react";

import { searchByRegistration } from "@/lib/api";

// 등록번호로 특허를 찾은 뒤, 실제 상세 화면은 출원번호 기준의 공용 상세페이지(/applicationNum)를 그대로 사용한다.
// (예전에는 이 페이지가 자체 컴포넌트 세트로 상세 화면 전체를 따로 렌더링했는데,
//  applicationNum 페이지와 기능이 중복되면서도 업데이트가 누락되곤 했음)
export default function RegistrationSearchPage() {
  const params = useParams();
  const router = useRouter();
  const registration = params?.registration;

  const regNo =
    typeof registration === "string"
      ? decodeURIComponent(registration)
      : null;

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!regNo) return;

    searchByRegistration(regNo)
      .then((result: any) => {
        const appNo = result?.result?.application_number;
        if (appNo) {
          router.replace(`/applicationNum/${appNo}`);
        } else {
          setError("해당 등록번호에 대한 출원번호 정보를 찾을 수 없습니다.");
        }
      })
      .catch((err) => {
        console.error("Error fetching patent:", err);
        setError(err.message || "특허 정보를 불러오는데 실패했습니다.");
      });
  }, [regNo]);

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
          <p className="text-red-600 mb-2">{error}</p>
          <p className="text-zinc-400 text-sm">등록번호: {regNo || "없음"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
        <p className="text-zinc-600 text-lg font-medium">
          출원번호를 조회하는 중...
        </p>
      </div>
    </div>
  );
}
