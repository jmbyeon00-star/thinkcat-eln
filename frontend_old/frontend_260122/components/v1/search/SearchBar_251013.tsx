"use client";
import { useState } from "react";

const CPC_SECTIONS = [
  { value: "a", label: "A - 생활필수품" },
  { value: "b", label: "B - 처리/운수" },
  { value: "c", label: "C - 화학/야금" },
  { value: "d", label: "D - 섬유/지류" },
  { value: "e", label: "E - 건설" },
  { value: "f", label: "F - 기계/조명/난방" },
  { value: "g", label: "G - 물리" },
  { value: "h", label: "H - 전기" },
  { value: "y", label: "Y - 범용 신기술" },
];

type Props = {
  loading: boolean;
  onSearch: (params: { keyword: string; category: string }) => void;
};

export function SearchBar({ loading, onSearch }: Props) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("a");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch({ keyword, category });
  };

  return (
    <form onSubmit={handleSubmit} className="flex justify-center gap-2 flex-wrap">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-2"
      >
        {CPC_SECTIONS.map((sec) => (
          <option key={sec.value} value={sec.value}>
            {sec.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="검색어를 입력하세요..."
        className="border border-gray-300 rounded-lg px-4 py-2 w-72"
      />

      <button
        type="submit"
        disabled={loading}
        className={`flex items-center justify-center px-4 py-2 rounded-lg text-white font-semibold min-w-[90px] ${
          loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        ) : (
          "검색"
        )}
      </button>
    </form>
  );
}
