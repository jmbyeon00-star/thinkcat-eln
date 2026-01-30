import { useRouter } from "next/router";
import { Check, RotateCw, ChevronRight, Sparkles } from "lucide-react";

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
    <div className="w-full py-8">
      {/* 💻 Desktop Stepper */}
      <ol className="hidden md:flex items-center w-full gap-4">
        {items.map((item, i) => {
          const idx = i + 1;
          const active = idx === step;
          const passed = idx < step;
          const clickable = idx < step;

          return (
            <li key={item.label} className={`flex items-center ${i !== items.length - 1 ? 'flex-1' : ''}`}>
              <div
                className={`flex items-center gap-4 transition-all duration-300 ${clickable ? "cursor-pointer group" : "cursor-default"
                  }`}
                onClick={() => {
                  if (clickable) router.push(item.href);
                }}
              >
                {/* 🔵 Step Number / Icon Box */}
                <div
                  className={`
                    flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-500
                    ${passed
                      ? "bg-slate-900 text-white shadow-lg shadow-slate-200"
                      : active
                        ? (idx === 3
                          ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-110"
                          : "bg-blue-600 text-white shadow-xl shadow-blue-100 scale-110") // 🎯 3단계가 아닐 때 Blue 적용
                        : "bg-zinc-100 text-zinc-400 border border-zinc-200"}
                    ${clickable && "group-hover:bg-blue-600 group-hover:scale-105"}
                  `}
                >
                  {passed ? (
                    <Check className="h-5 w-5" strokeWidth={3} />
                  ) : active ? (
                    idx === 3 ? (
                      <Sparkles className="h-5 w-5 animate-pulse text-indigo-200" />
                    ) : (
                      <ChevronRight className="h-5 w-5 animate-pulse opacity-70" strokeWidth={3} />
                    )
                  ) : (
                    <span className="font-black text-sm">{idx}</span>
                  )}
                </div>

                {/* 📝 Label Group */}
                <div className="flex flex-col text-left">
                  <span
                    className={`
                      text-[10px] font-black uppercase tracking-[0.2em] transition-colors
                      ${active ? "text-indigo-600" : passed ? "text-slate-900" : "text-zinc-400"}
                    `}
                  >
                    Step {idx}
                  </span>
                  <span
                    className={`
                      text-[13px] font-black transition-all mt-0.5
                      ${active ? "text-slate-900 scale-105" : passed ? "text-slate-600" : "text-zinc-400"}
                      ${clickable && "group-hover:text-indigo-600"}
                    `}
                  >
                    {item.label}
                  </span>
                </div>
              </div>

              {/* 🔗 Connector Line */}
              {i < items.length - 1 && (
                <div className="flex-1 mx-6 h-[2px] bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ease-in-out ${passed ? "w-full bg-slate-900" : "w-0 bg-indigo-600"
                      }`}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {/* 📱 Mobile Stepper */}
      <div className="md:hidden space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Current Progress</span>
            <span className="text-xl font-black text-slate-900">{items[step - 1]?.label}</span>
          </div>
          <span className="text-sm font-black bg-slate-100 px-3 py-1 rounded-full text-slate-500">
            {step} / {items.length}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="flex gap-1.5 h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
          {items.map((_, i) => (
            <div
              key={i}
              className={`h-full rounded-full transition-all duration-500 ${i + 1 === step
                ? "flex-[2] bg-indigo-600"
                : i + 1 < step
                  ? "flex-1 bg-slate-900"
                  : "flex-1 bg-zinc-200"
                }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}