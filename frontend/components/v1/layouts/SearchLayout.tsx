"use client";

import Stepper from "./SearchStepper";

export default function SearchLayout({
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
    <div className="mt-6 mx-auto w-full max-w-6xl px-4">
      <header>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-zinc-900">
          특허 검색
        </h1>
        <p className="mt-2 text-sm md:text-base text-zinc-500">
          특허 검색 페이지
        </p>
      </header>

      <div className="mt-6 mb-6">
        <Stepper step={step} items={stepItems} />
      </div>

      {children}
    </div>
  );
}