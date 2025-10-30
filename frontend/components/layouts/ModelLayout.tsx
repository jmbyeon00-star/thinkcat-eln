import Stepper from "./ProjectStepper";

const stepItems = ["기본정보", "데이터 소스", "매칭/미리보기", "콜렉션 통계", "학습 설정"];

export default function ModelLayout({
  step,
  children,
}: {
  step: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 mx-auto w-full max-w-6xl px-4">
      {/* 제목 + 설명 */}
      <header>
        {/* <h1 className="text-2xl font-semibold text-zinc-900"> */}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
            인공지능 관리
        </h1>
        {/* <p className="mt-1 text-sm text-zinc-500"> */}
        <p className="mt-2 text-sm md:text-base text-zinc-500">
          학습된 인공지능 모델을 관리합니다.
        </p>
      </header>

      {/* Stepper */}
      <div className="mt-6 mb-6">
        <Stepper step={step} items={stepItems} />
      </div>

      {/* 본문 */}
      {children}
    </div>
  );
}
