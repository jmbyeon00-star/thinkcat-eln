"use client";
import React, { useState } from "react";
import { PaginationSearchResp } from "@lib/types";
import { useRouter } from "next/router";
import { useSearchParams } from "next/navigation";

type Props = {
  resp: PaginationSearchResp | null;
  page: number;
  loading: boolean;
  keyword: string;
  onChangePage: (page: number) => void;
};

export function SearchResults({ resp, page, loading, keyword, onChangePage }: Props) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [openRow, setOpenRow] = useState<string | null>(null);

    // ✅ 디버깅: 받은 데이터 확인
    console.log("=== SearchResults Debug ===");
    console.log("resp:", resp);
    console.log("resp.data:", resp?.data);
    console.log("resp.data.length:", resp?.data?.length);
    console.log("resp.total_hits:", resp?.total_hits);
    console.log("resp.total_pages:", resp?.total_pages);
    console.log("loading:", loading);
    console.log("========================");

    if (loading)
        return <p className="text-center text-zinc-500 mt-10 mb-10">검색 중...</p>;
    if (!resp || !resp.data?.length)
        return <p className="text-center text-zinc-400 mt-10 mb-10">검색 결과가 없습니다.</p>;

    const totalPages = resp.total_pages;
    
    const handleRowClick = (appNum: string) => {
        router.push(`/search/detail/application/${appNum}?keyword=${keyword}`);
    };

    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
        <div className="max-w-5xl mx-auto mt-8 mb-10">

            {/* 테이블 */}
            <div className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm bg-white">
                <table className="w-full border-collapse text-sm">
                <thead>
                    <tr className="bg-zinc-50 text-zinc-600 text-left">
                    <th className="px-6 py-3 font-semibold w-[55%]">특허 제목</th>
                    <th className="px-6 py-3 font-semibold w-[20%] text-center">출원번호</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                    {resp.data.map((item, idx) => (
                    <React.Fragment key={item.application_number}>
                        {/* 메인 행 */}
                        <tr
                        onClick={() => handleRowClick(item.application_number)}
                        className={`cursor-pointer transition ${
                            openRow === item.application_number
                            ? "bg-zinc-100"
                            : "hover:bg-zinc-50"
                        }`}
                        >
                            <td className="px-6 py-3 font-medium text-zinc-900">
                                {item.title}
                            </td>
                            <td className="px-6 py-3 text-center text-zinc-600 font-mono text-xs">
                                {item.application_number}
                            </td>
                        </tr>

                        {/* 클릭 시 요약문 표시 */}
                        {openRow === item.application_number && (
                            <tr className="bg-zinc-50">
                                <td
                                colSpan={4}
                                className="px-6 py-4 text-zinc-700 border-t border-zinc-200 leading-relaxed"
                                >
                                    <div className="space-y-2">
                                        <div><strong>초록:</strong> {item.abstract || "요약문이 없습니다."}</div>
                                        {item.grant_date && <div><strong>등록일:</strong> {item.grant_date}</div>}
                                        {item.cpc_code && <div><strong>CPC 코드:</strong> {item.cpc_code}</div>}
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                    ))}
                </tbody>
                </table>
            </div>

            {/* 페이지네이션 */}
            <div className="mt-6 flex justify-center gap-2">
                <button
                onClick={() => onChangePage(1)}
                disabled={!resp.has_prev}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                처음
                </button>
                <button
                onClick={() => onChangePage(page - 1)}
                disabled={!resp.has_prev}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                이전
                </button>

                {pages.map((num) => (
                <button
                    key={num}
                    onClick={() => onChangePage(num)}
                    className={`px-3 py-1 rounded border text-sm transition ${
                    num === page
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-zinc-700 hover:bg-zinc-100"
                    }`}
                >
                    {num}
                </button>
                ))}

                <button
                onClick={() => onChangePage(page + 1)}
                disabled={!resp.has_next}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                다음
                </button>
                <button
                onClick={() => onChangePage(totalPages)}
                disabled={!resp.has_next}
                className="px-3 py-1 rounded border text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 transition"
                >
                끝
                </button>
            </div>

            {/* 페이지 정보 */}
            <p className="text-center text-zinc-500 text-sm mt-3">
                <strong className="text-zinc-700">{totalPages}</strong>페이지 중 <strong className="text-blue-600">{page}</strong>페이지
            </p>
        </div>
    );
}