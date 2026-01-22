import Stepper from "./Stepper";

const stepItems = ["기본정보", "데이터 추가", "미리보기", "통계", "학습 설정"];

export default function ProjectLayout({
  step,
  sourceType,
  projectNo,
  children,
}: {
  step: number;
  sourceType?: string;
  projectNo?: number;
  children: React.ReactNode;
}) {
  const stepItems = [
    { label: "기본정보", href: "/project/new" },
    { label: "데이터 추가", href: sourceType && projectNo ? `/project/${sourceType}/${projectNo}` : "#" },
    { label: "미리보기", href: projectNo ? `/project/preview/${projectNo}` : "#" },
    { label: "통계", href: projectNo ? `/project/stats/${projectNo}` : "#" },
    { label: "학습 설정", href: projectNo ? `/project/train/${projectNo}` : "#" },
  ];
  return (
    <div className="mt-10 mx-auto w-full max-w-6xl pl-5 pr-5">
      {/* 제목 + 설명 */}
      <header>
        {/* <h1 className="text-2xl font-semibold text-zinc-900"> */}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
          프로젝트 관리
        </h1>
        {/* <p className="mt-1 text-sm text-zinc-500"> */}
        <p className="mt-2 text-sm md:text-base text-zinc-500">
          DB 검색 기반으로 프로젝트를 만듭니다.
        </p>
      </header>

      {/* Stepper */}
      <div className="mt-4 mb-1">
        <Stepper step={step} items={stepItems} />
      </div>

      {/* 본문 */}
      {children}
    </div>
  );
}
