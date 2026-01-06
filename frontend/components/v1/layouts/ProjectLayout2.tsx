import Stepper from "./Stepper";
import { Plus } from "lucide-react";

export default function ProjectLayout({
  step,
  sourceType,
  projectNo,
  projectName,
  projectDesc,
  children,
}: {
  step: number;
  sourceType?: string;
  projectNo?: number;
  projectName?: string;
  projectDesc?: string;
  children: React.ReactNode;
}) {
  const stepItems = [
    { label: "프로젝트 생성", href: "/project/new" },
    { label: "데이터 추가", href: sourceType && projectNo ? `/project/${sourceType}/${projectNo}` : "#" },
    { label: "데이터 편집", href: projectNo ? `/project/preview/${projectNo}` : "#" },
    { label: "데이터 통계", href: projectNo ? `/project/stats/${projectNo}` : "#" },
    { label: "완료", href: projectNo ? `/project/train/${projectNo}` : "#" },
  ];

  const handleAddData = () => {
    console.log("d")
  }

  return (
    <div className="w-full bg-white">
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
              <div className="flex">
                <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 pr-3">
                  {projectName || "프로젝트명 없음"}
                </h1>
                {/* Add Patent data */}
                {/* <div className="relative group">
                    <button
                        onClick={navigateToNew}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-md"
                    >
                        <Plus className="h-5 w-5" />
                    </button>

                    <div
                        // className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded-md px-2 py-1 transition-all"
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 whitespace-nowrap opacity-0 group-hover:opacity-100 bg-gray-900 text-white text-xs rounded-md px-2 py-1 transition-opacity pointer-events-none"
                    >
                        데이터 추가
                    </div>
                </div> */}
                <button
                  onClick={() => handleAddData()}
                  className="group flex items-center justify-center w-10 h-10 rounded-full bg-white text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all duration-300 shadow-md overflow-hidden hover:w-32 hover:rounded-3xl">
                  {/* 기본 아이콘 */}
                  <div
                    className="absolute flex items-center justify-center transition-opacity duration-200 group-hover:opacity-0">
                    <Plus className="h-5 w-5" />
                  </div>

                  {/* hover 시 나타나는 텍스트 */}
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 text-sm font-medium whitespace-nowrap">
                    데이터 추가
                  </span>
                </button>
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

      {/* Stepper 네비게이션 */}
      <div className="bg-white">
        <div className="mx-auto w-full max-w-6xl px-5">
          <Stepper step={step} items={stepItems} />
        </div>
      </div>

      {/* 본문 컨텐츠 */}
      <div className="mt-6 mx-auto w-full max-w-6xl px-5 pb-10">
        {children}
      </div>
    </div>
  );
}