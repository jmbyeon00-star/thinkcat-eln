// File: frontend/components/ui/button.tsx
import * as React from "react";
import Link from "next/link";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@/lib/utils";

const buttonStyles = tv({
  base: [
    // 레이아웃
    "relative inline-flex items-center gap-3 rounded-2xl",
    "border border-black/5 dark:border-white/5",
    "px-5 py-4 select-none",
    // 색 / 텍스트
    "bg-white dark:bg-zinc-900",
    "text-zinc-800 dark:text-zinc-100",
    // 기본 그림자(떠 있는 느낌)
    "shadow-[0_1px_0_rgba(0,0,0,0.03),0_6px_14px_rgba(0,0,0,0.06)]",
    // 호버 시 더 진한 그림자
    "hover:shadow-[0_2px_0_rgba(0,0,0,0.04),0_12px_28px_rgba(0,0,0,0.10)]",
    // 눌림(press) 피드백
    "active:translate-y-[1px] active:shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]",
    // 포커스 링
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
    // 미세한 상단 하이라이트(광택): before 가는 인셋 라이트
    "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl",
    "before:shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:before:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    // 트랜지션
    "transition-[transform,box-shadow] duration-150",
    "disabled:opacity-50 disabled:cursor-not-allowed",
  ].join(" "),
  variants: {
    size: {
      md: "h-20",
      lg: "h-24",
    },
    fullWidth: { true: "w-full" },
    align: {
      left: "justify-start",
      center: "justify-center",
      between: "justify-between",
    },
  },
  defaultVariants: {
    size: "lg",
    align: "between",
  },
});

type BaseProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  React.AnchorHTMLAttributes<HTMLAnchorElement> &
  VariantProps<typeof buttonStyles> & {
    href?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    title?: string;       // 라벨 강조 텍스트
    caption?: string;     // 보조 설명 텍스트
  };

// 내부 콘텐츠 레이아웃
function ButtonBody({
  leftIcon,
  rightIcon,
  title,
  caption,
  children,
}: Pick<BaseProps, "leftIcon" | "rightIcon" | "title" | "caption" | "children">) {
  return (
    <>
      {leftIcon ? (
        <span className="grid place-items-center rounded-xl p-2 bg-zinc-100 dark:bg-zinc-800">
          {leftIcon}
        </span>
      ) : null}
      <span className="flex flex-col text-left">
        <span className="text-base md:text-lg font-medium leading-none">{title ?? children}</span>
        {caption ? (
          <span className="mt-1 text-xs md:text-sm text-zinc-600 dark:text-zinc-400">
            {caption}
          </span>
        ) : null}
      </span>
      {rightIcon ? <span className="ml-auto">{rightIcon}</span> : null}
    </>
  );
}

export const Button = React.forwardRef<
  HTMLButtonElement & HTMLAnchorElement,
  BaseProps
>(function Button(
  { className, size, fullWidth, align, href, leftIcon, rightIcon, title, caption, children, ...props },
  ref
) {
  const cls = cn(buttonStyles({ size, fullWidth, align }), className);
  if (href) {
    return (
      <Link href={href} className={cls} {...(props as any)}>
        <ButtonBody {...{ leftIcon, rightIcon, title, caption, children }} />
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} {...props}>
      <ButtonBody {...{ leftIcon, rightIcon, title, caption, children }} />
    </button>
  );
});
