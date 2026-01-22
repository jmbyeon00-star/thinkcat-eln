// components/layouts/ProjectLayout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

export default function ProjectLayout({
  sourceType,
  projectNo,
  projectName,
  projectDesc,
  onAddData,
  children,
}: {
  sourceType?: string;
  projectNo?: number;
  projectName?: string;
  projectDesc?: string;
  onAddData?: () => void;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const tabs = [
    { id: "home", label: "홈", href: `/project/${projectNo}` },
    { id: "data", label: "데이터", href: `/project/${projectNo}/data/${sourceType?.toLowerCase()}` },
    { id: "models", label: "모델", href: `/project/${projectNo}/models` },
  ];

  // 데이터 서브 탭
  const dataSubTabs = [
    { id: "data", label: "데이터 추가", href: `/project/${projectNo}/data/${sourceType?.toLowerCase()}` },
    { id: "preview", label: "미리보기", href: `/project/${projectNo}/preview` },
    { id: "stats", label: "통계", href: `/project/${projectNo}/stats` },
  ];

  // 현재 활성화된 메인 탭 확인
  const getActiveTab = () => {
    if (!pathname || !projectNo) return "home";

    if (pathname.includes("/models")) return "models";
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

                {onAddData && (
                  <button
                    onClick={onAddData}
                    className="group flex items-center justify-center w-10 h-10 rounded-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-md overflow-hidden hover:w-32 hover:rounded-3xl"
                  >
                    <div className="absolute flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0">
                      <Plus className="h-5 w-5" />
                    </div>
                    <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 text-sm font-medium whitespace-nowrap">
                      데이터 추가
                    </span>
                  </button>
                )}
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
        <div className="bg-white border-b border-zinc-200">
          <div className="mx-auto w-full max-w-6xl px-5">
            <nav className="flex gap-6 -mb-px">
              {dataSubTabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`py-3 text-sm font-medium transition-colors relative ${activeDataSubTab === tab.id
                    ? "text-blue-600"
                    : "text-zinc-500 hover:text-zinc-900"
                    }`}
                >
                  {tab.label}
                  {activeDataSubTab === tab.id && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                  )}
                </Link>
              ))}
            </nav>
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