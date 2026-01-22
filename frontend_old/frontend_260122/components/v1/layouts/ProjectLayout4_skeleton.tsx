// components/layouts/ProjectLayout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

// 1. Props 인터페이스 정의 (TypeScript에서 타입 검사를 위해 필요)
interface ProjectLayoutProps {
  sourceType?: string;
  projectNo?: number;
  projectName?: string;
  projectDesc?: string;
  onFunction?: () => void;
  isLoading?: boolean; // ✅ isLoading prop 추가
  children: React.ReactNode;
}

export default function ProjectLayout({
  sourceType,
  projectNo,
  projectName,
  projectDesc,
  onFunction, // onFunction은 현재 사용되지 않으므로 필요 시 삭제 가능합니다.
  isLoading, // ✅ isLoading prop 받기
  children,
}: ProjectLayoutProps) {
  const pathname = usePathname();

  // 3. ✅ 로딩 중이거나 프로젝트 번호가 없을 때 스켈레톤 렌더링 (핵심 로직)
  if (isLoading || !projectNo) {
    return <ProjectSkeleton />;
  }

  // projectNo가 있으므로 이제 탭 관련 로직은 안전합니다.
  const tabs = [
    { id: "home", label: "홈", href: `/project/${projectNo}` },
    { id: "data", label: "학습 데이터", href: `/project/${projectNo}/data/${sourceType?.toLowerCase()}` },
    { id: "models", label: "모델", href: `/project/${projectNo}/models` },
    { id: "result", label: "분류 결과", href: `/project/${projectNo}/result` },
  ];

  // 데이터 서브 탭
  const dataSubTabs = [
    { id: "data", label: "데이터 추가", href: `/project/${projectNo}/data/${sourceType?.toLowerCase()}` },
    { id: "preview", label: "미리보기", href: `/project/${projectNo}/preview` },
    { id: "stats", label: "통계", href: `/project/${projectNo}/stats` },
  ];

  // 현재 활성화된 메인 탭 확인
  const getActiveTab = () => {
    // projectNo가 있으므로 pathname만 확인
    if (!pathname) return "home";

    if (pathname.includes("/models")) return "models";
    if (pathname.includes("/result")) return "result";
    if (pathname.includes("/data") || pathname.includes("/preview") || pathname.includes("/stats")) {
      return "data";
    }
    return "home";
  };

  // 현재 활성화된 데이터 서브 탭 확인
  const getActiveDataSubTab = () => {
    if (pathname?.includes("/data")) return "data";
    if (pathname?.includes("/preview")) return "preview";
    if (pathname?.includes("/stats")) return "stats";
    return "data";
  };

  const activeTab = getActiveTab();
  const activeDataSubTab = getActiveDataSubTab();
  const showDataSubTabs = activeTab === "data";

  // -------------------------------------------------------------
  // 🟢 로딩 완료 시: 실제 ProjectLayout UI 렌더링
  // -------------------------------------------------------------
  return (
    <div className="w-full bg-white min-h-screen">
      {/* 프로필 섹션 */}
      <div className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6 m-3 md:mt-5 pb-6">
            {/* 프로필 이미지 */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-2xl md:text-3xl border-4 border-white shadow-lg flex-shrink-0">
              {projectName ? projectName.charAt(0).toUpperCase() : "P"}
            </div>

            {/* 프로젝트 정보 */}
            <div className="flex-grow pb-2">
              <div className="flex items-center">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 pr-3">
                  {projectName || "프로젝트명 없음"}
                </h1>

                <Link
                  href={`/project/${projectNo}/data/${sourceType}`}
                  className="group flex items-center justify-center w-10 h-10 rounded-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-md overflow-hidden hover:w-32 hover:rounded-3xl"
                >
                  <div className="absolute flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 text-sm font-medium whitespace-nowrap">
                    데이터 추가
                  </span>
                </Link>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                {projectNo && (
                  <>
                    <span>프로젝트 #{projectNo}</span>
                    <span>•</span>
                  </>
                )}
                {sourceType && <span>{sourceType.toUpperCase()}</span>}
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                {projectDesc || "프로젝트 설명 없음"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 메인 탭 네비게이션 */}
      <div className="bg-white border-b border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-5">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`py-3 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-600 hover:text-zinc-900"
                  }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* 데이터 서브 탭 (데이터 탭이 활성화되었을 때만 표시) */}
      {showDataSubTabs && (
        <div className="bg-zinc-50 border-b border-zinc-200">
          <div className="mx-auto w-full max-w-6xl px-5 py-4">
            <div className="inline-flex rounded-lg border border-zinc-200 p-1 bg-white">
              {dataSubTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeDataSubTab === tab.id
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50"
                    }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 본문 컨텐츠 */}
      <div className="mx-auto w-full max-w-6xl px-5 py-8">
        {children}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------
// 2. ✅ 내부 ProjectSkeleton 컴포넌트 정의
// ------------------------------------------------------------------
function ProjectSkeleton() {
  return (
    <div className="w-full bg-white min-h-screen animate-pulse">
      {/* 프로필 섹션 스켈레톤 */}
      <div className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6 m-3 md:mt-5 pb-6">
            {/* 원형 이미지 스켈레톤 */}
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full bg-zinc-200 border-4 border-white shadow-lg flex-shrink-0" />

            {/* 텍스트 정보 스켈레톤 */}
            <div className="flex-grow pb-2 w-full">
              <div className="flex items-center mb-3">
                {/* 제목 */}
                <div className="h-8 w-48 bg-zinc-200 rounded-md" />
                {/* 버튼 */}
                <div className="h-10 w-10 bg-zinc-200 rounded-full ml-3" />
              </div>

              {/* 메타 정보 */}
              <div className="mt-1 flex items-center gap-2 mb-3">
                <div className="h-4 w-24 bg-zinc-200 rounded-md" />
                <div className="h-4 w-16 bg-zinc-200 rounded-md" />
              </div>
              {/* 설명 */}
              <div className="h-4 w-full max-w-md bg-zinc-200 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 스켈레톤 */}
      <div className="bg-white border-b border-zinc-200">
        <div className="mx-auto w-full max-w-6xl px-5">
          <div className="flex gap-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="py-3">
                <div className="h-5 w-20 bg-zinc-200 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 본문 컨텐츠 영역 스켈레톤 */}
      <div className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="h-24 bg-zinc-200 rounded-lg" />
            <div className="h-24 bg-zinc-200 rounded-lg" />
            <div className="h-24 bg-zinc-200 rounded-lg" />
          </div>
          <div className="h-48 w-full bg-zinc-200 rounded-lg" />
          <div className="h-48 w-full bg-zinc-200 rounded-lg" />
        </div>
      </div>
    </div>
  );
}