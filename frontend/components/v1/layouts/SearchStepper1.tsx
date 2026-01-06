"use client";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";

export type Step = number;

interface StepItem {
  label: string;
  href: string;
}

interface StepperProps {
  step: Step;        // 현재 단계
  items: StepItem[]; // 단계 목록
}

export default function SearchStepper({ step, items }: StepperProps) {
  const router = useRouter();

  return (
    <ol className="mt-6 flex flex-wrap items-center gap-3 text-sm">
      {items.map((item, i) => {
        const idx = i + 1;
        const active = idx === step;
        const passed = idx < step;
        const clickable = idx < step; // 현재보다 이전 단계만 클릭 가능

        return (
          <li
            key={item.label}
            className={`flex items-center gap-3 ${
              clickable ? "cursor-pointer" : "cursor-default"
            }`}
            onClick={() => {
              if (clickable) router.push(item.href);
            }}
          >
            <div
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full ring-1 transition-all duration-300",
                passed
                  ? "bg-green-50 ring-green-300 text-green-700"
                  : active
                  ? "bg-blue-600 ring-blue-600 text-white"
                  : "bg-white ring-zinc-300 text-zinc-400",
                clickable && "hover:ring-blue-400 hover:text-blue-600",
              ].join(" ")}
            >
              {passed ? <CheckCircle2 className="h-5 w-5" /> : idx}
            </div>

            <span
              className={[
                "transition-colors",
                active
                  ? "font-medium text-zinc-900"
                  : passed
                  ? "text-zinc-700"
                  : "text-zinc-400",
                clickable && "hover:text-blue-600",
              ].join(" ")}
            >
              {item.label}
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
