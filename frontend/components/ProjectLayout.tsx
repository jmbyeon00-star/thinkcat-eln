import Stepper from "./ProjectStepper";

const stepItems = ["기본정보", "데이터 소스", "매칭/미리보기", "라벨/클래스", "학습 설정"];

export default function ProjectLayout({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-10 mx-auto w-full max-w-6xl">
      {/* 제목 + 설명 */}
      <header>
        {/* <h1 className="text-2xl font-semibold text-zinc-900"> */}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
            프로젝트 생성
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
