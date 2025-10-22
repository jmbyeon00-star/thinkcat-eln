import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight } from "lucide-react";

export type Step = number;

interface StepItem {
  label: string;
  href: string;
}

interface StepperProps {
  step: Step;
  items: StepItem[];
}

export default function SearchStepper({ step, items }: StepperProps) {
  const router = useRouter();

  return (
    <div className="w-full">
      {/* Desktop Stepper */}
      <ol className="hidden md:flex items-center justify-between w-full">
        {items.map((item, i) => {
          const idx = i + 1;
          const active = idx === step;
          const passed = idx < step;
          const clickable = idx < step;

          return (
            <li
              key={item.label}
              className="flex-1 flex items-center"
            >
              <div
                className={`flex items-center gap-3 ${
                  clickable ? "cursor-pointer group" : "cursor-default"
                }`}
                onClick={() => {
                  if (clickable) router.push(item.href);
                }}
              >
                {/* Circle */}
                <div
                  className={[
                    "flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300 shadow-sm",
                    passed
                      ? "bg-gradient-to-br from-green-400 to-emerald-500 text-white"
                      : active
                      ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white ring-4 ring-blue-100"
                      : "bg-white ring-2 ring-zinc-200 text-zinc-400",
                    clickable && "group-hover:ring-4 group-hover:ring-blue-100 group-hover:scale-110",
                  ].join(" ")}
                >
                  {passed ? (
                    <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                  ) : (
                    <span className="font-bold text-sm">{idx}</span>
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col">
                  <span
                    className={[
                      "text-xs uppercase tracking-wide font-semibold transition-colors",
                      active
                        ? "text-blue-600"
                        : passed
                        ? "text-emerald-600"
                        : "text-zinc-400",
                      clickable && "group-hover:text-blue-600",
                    ].join(" ")}
                  >
                    Step {idx}
                  </span>
                  <span
                    className={[
                      "text-sm font-medium transition-colors mt-0.5",
                      active
                        ? "text-zinc-900"
                        : passed
                        ? "text-zinc-700"
                        : "text-zinc-400",
                      clickable && "group-hover:text-zinc-900",
                    ].join(" ")}
                  >
                    {item.label}
                  </span>
                </div>
              </div>

              {/* Connector Line */}
              {i < items.length - 1 && (
                <div className="flex-1 h-0.5 mx-4">
                  <div
                    className={[
                      "h-full transition-all duration-500",
                      passed
                        ? "bg-gradient-to-r from-emerald-400 to-emerald-300"
                        : "bg-zinc-200",
                    ].join(" ")}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* Mobile Stepper */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-zinc-600">
            Step {step} of {items.length}
          </span>
          <div className="flex gap-1.5">
            {items.map((_, i) => (
              <div
                key={i}
                className={[
                  "h-1.5 rounded-full transition-all duration-300",
                  i + 1 === step
                    ? "w-8 bg-gradient-to-r from-blue-500 to-indigo-600"
                    : i + 1 < step
                    ? "w-6 bg-emerald-400"
                    : "w-6 bg-zinc-200",
                ].join(" ")}
              />
            ))}
          </div>
        </div>
        
        {/* Current Step Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
              <span className="font-bold">{step}</span>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide font-semibold text-blue-600">
                Current Step
              </div>
              <div className="text-sm font-semibold text-zinc-900">
                {items[step - 1]?.label}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}