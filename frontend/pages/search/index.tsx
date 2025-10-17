"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/search/SearchBar";
import SearchLayout from "@/components/SearchLayout";

export default function SearchIndexPage() {
  const router = useRouter();
  const [searchType, setSearchType] = useState<
    "keyword" | "application" | "registration"
  >("keyword");

  const handleSearch = ({ keyword, category }: { keyword: string; category: string }) => {
    if (!keyword.trim()) return;

    if (searchType === "keyword") {
        router.push(
            `/search/keyword/${encodeURIComponent(keyword)}?category=${category}`
        );
        } else if (searchType === "application") {
            router.push(`/search/application/${encodeURIComponent(keyword)}`);
        } else {
            router.push(`/search/registration/${encodeURIComponent(keyword)}`);
        }
    };

  return (
    <SearchLayout step={1}>
        <div className="bg-white shadow-md rounded-xl p-6 w-full max-w-2xl">
            <div className="flex justify-start mb-4">
            <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="border px-3 py-2 rounded-lg text-sm"
            >
                <option value="keyword">키워드 검색</option>
                <option value="application">출원번호</option>
                <option value="registration">등록번호</option>
            </select>
            </div>

            <SearchBar loading={false} onSearch={handleSearch} />
        </div>
    </SearchLayout>
  );
}
