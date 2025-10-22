import { CheckCircle2, ChevronRight } from "lucide-react";

export type Step = number; // 고정 타입 대신 number로 열어둠

interface StepperProps {
  step: Step;          // 현재 진행 단계
  items: string[];     // 각 페이지에서 전달할 단계 이름
}

export default function ProjectStepper({ step, items }: StepperProps) {
  return (
    <ol className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      {items.map((t, i) => {
        const idx = i + 1;
        const active = idx === step;
        const passed = idx < step;
        return (
          <li key={t} className="flex items-center gap-3">
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full ring-1",
                passed
                  ? "bg-green-50 ring-green-300 text-green-700"
                  : active
                  ? "bg-blue-600 ring-blue-600 text-white"
                  : "bg-white ring-zinc-300 text-zinc-500",
              ].join(" ")}
            >
              {passed ? <CheckCircle2 className="h-5 w-5" /> : idx}
            </div>
            <span className={active ? "font-medium text-zinc-900" : "text-zinc-500"}>
              {t}
            </span>
            {i < items.length - 1 && (
              <ChevronRight className="h-4 w-4 text-zinc-300" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
