import { useState, FormEvent } from "react";

type Props = {
  placeholder?: string;
  loading?: boolean;
  onSearch: (keyword: string) => void;
};

export default function SearchBarSimple({ placeholder, loading, onSearch }: Props) {
  const [value, setValue] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onSearch(value.trim());
  };

  return (
    <form onSubmit={submit} className="flex justify-center mt-10 gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || "검색어를 입력하세요"}
        className="w-80 border-2 border-blue-600 rounded-l-full px-4 py-2 text-base outline-none"
      />
      <button
        type="submit"
        disabled={loading}
        className={`px-6 py-2 rounded-r-full text-white font-semibold transition-all ${
          loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {loading ? "검색중…" : "검색"}
      </button>
    </form>
  );
}
