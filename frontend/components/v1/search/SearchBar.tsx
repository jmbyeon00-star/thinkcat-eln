import { useState, FormEvent } from "react";
import { Search, Loader2 } from "lucide-react";

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
  searchType?: "keyword" | "application" | "registration";
};

export function SearchBar({ loading, onSearch, searchType = "keyword" }: Props) {
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("a");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!keyword.trim()) return;
    onSearch({ keyword: keyword.trim(), category });
  };

  // 검색 타입에 따른 텍스트 설정
  const getSearchLabel = () => {
    switch (searchType) {
      case "application":
        return "출원번호 입력";
      case "registration":
        return "등록번호 입력";
      default:
        return "검색어 입력";
    }
  };

  const getPlaceholder = () => {
    switch (searchType) {
      case "application":
        return "출원번호를 입력하세요...";
      case "registration":
        return "등록번호를 입력하세요...";
      default:
        return "특허 검색어를 입력하세요...";
    }
  };

  const getHeaderDescription = () => {
    switch (searchType) {
      case "application":
        return "출원번호로 특허를 검색하세요";
      case "registration":
        return "등록번호로 특허를 검색하세요";
      default:
        return "CPC 분류와 키워드로 특허를 검색하세요";
    }
  };

  const getHelperText = () => {
    switch (searchType) {
      case "application":
        return "출원번호를 정확히 입력하세요. 예:1020240001234(13자리)";
      case "registration":
        return "등록번호를 정확히 입력하세요. 예:1016473180000(13자리)";
      default:
        return "CPC 분류를 선택하고 관련 키워드를 입력하면 더 정확한 검색 결과를 얻을 수 있습니다.";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 mb-6">
      <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h2 className="text-xl font-semibold text-white mb-2">
            특허 검색
          </h2>
          <p className="text-blue-100 text-sm">
            {getHeaderDescription()}
          </p>
        </div>

        {/* Content */}
        <div className="p-8 space-y-6">
          {/* Category Selector - 키워드 검색일 때만 표시 */}
          {searchType === "keyword" && (
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
                CPC 분류 선택
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-5 py-3.5 bg-white border-2 border-zinc-200 rounded-xl text-zinc-900 font-medium 
                  focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                  transition-all duration-200 cursor-pointer hover:border-blue-400
                  shadow-sm hover:shadow-md"
              >
                {CPC_SECTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Input */}
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-3 flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" />
              {getSearchLabel()}
            </label>
            <div className="flex items-stretch shadow-lg hover:shadow-xl transition-shadow duration-200 rounded-xl overflow-hidden">
              <div className="relative flex-1">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none">
                  <Search size={20} />
                </div>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  placeholder={getPlaceholder()}
                  disabled={loading}
                  className="w-full pl-12 pr-4 py-4 bg-white border-2 border-zinc-200 
                    focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100
                    text-zinc-900 placeholder-zinc-400 
                    transition-all duration-200
                    disabled:bg-zinc-50 disabled:cursor-not-allowed
                    rounded-l-xl border-r-0"
                />
              </div>
              <button
                onClick={handleSubmit}
                disabled={loading || !keyword.trim()}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 
                  text-white font-bold text-base
                  hover:from-blue-700 hover:to-indigo-700
                  disabled:from-zinc-300 disabled:to-zinc-400 disabled:cursor-not-allowed
                  transition-all duration-200
                  flex items-center justify-center gap-2 min-w-[120px]
                  rounded-r-xl"
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>검색중</span>
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    <span>검색</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Helper Text */}
          <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
            <div className="text-blue-600 mt-0.5">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm text-blue-900 font-semibold mb-1 text-left">
                검색 팁
              </p>
              <p className="text-xs text-blue-800 leading-relaxed text-left">
                {getHelperText()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 