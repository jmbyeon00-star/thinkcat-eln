import Stepper from "./SearchStepper";

export default function ModelLayout({
  step,
  keyword,
  number,
  children,
}: {
  step: number;
  keyword?: string;
  number?: number;
  children: React.ReactNode;
}) {
  const stepItems = [
    { label: "검색 페이지", href: "/search" },
    { label: "검색 결과", href: keyword ? `/search/keyword/${keyword}` : "#" },
    { label: "상세 페이지", href: number ? `/search/detail/${number}` : "#" },
  ];

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
            <h1 className="text-3xl font-bold text-zinc-900">
              특허 검색
            </h1>
          </div>
          <p className="text-zinc-600 ml-4">
            키워드로 특허를 검색하고 상세 정보를 확인하세요
          </p>
        </div>

        {/* Stepper Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-100 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4">
            <h2 className="text-lg font-semibold text-white">
              검색 진행 상황
            </h2>
          </div>
          <div className="p-6">
            <Stepper step={step} items={stepItems} />
          </div>
        </div>

        {/* Content Area */}
        <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}