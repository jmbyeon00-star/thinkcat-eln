import { useState, FormEvent } from "react";
import { Search, Loader2, Info, ChevronDown, Sparkles, ArrowRight } from "lucide-react";

const CPC_SECTIONS = [
  { value: "all", label: "전체"}
  { value: "a", label: "A - 생활필수품" },
  { value: "b", label: "B - 처리·운수" },
  { value: "c", label: "C - 화학·야금" },
  { value: "d", label: "D - 섬유·지류" },
  { value: "e", label: "E - 건설" },
  { value: "f", label: "F - 기계·조명" },
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
  const [category, setCategory] = useState("all");

  const handleSubmit = (e: FormEvent | MouseEvent | KeyboardEvent) => {
    if (e && 'preventDefault' in e) e.preventDefault();

    if (!keyword.trim()) return;
    onSearch({
      keyword: keyword.trim(),
      category: searchType === "keyword" ? category : ""
    });
  };

  const getPlaceholder = () => {
    switch (searchType) {
      case "application": return "출원번호 13자리를 입력하세요 (예: 1020140054109)";
      case "registration": return "등록번호 13자리를 입력하세요 (예: 1013900690000)";
      default: return "특허 핵심 키워드를 입력하세요...";
    }
  };

  const getHelperText = () => {
    switch (searchType) {
      case "application": return "출원번호 기반의 정밀 탐색을 시작합니다.";
      case "registration": return "확정 등록번호를 통해 지식 자산을 조회합니다.";
      default: return "CPC 분류와 키워드 조합으로 가장 유사한 기술 문맥을 추론합니다.";
    }
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <div className="space-y-6">
        {/* 1. Category Selector - 키워드 검색일 때만 상단에 세련되게 노출 */}
        {searchType === "keyword" && (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
              <Sparkles size={12} className="text-blue-600" /> Technology Category
            </label>
            <div className="relative group">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none px-6 py-4 bg-zinc-50 border border-zinc-100 rounded-2xl text-zinc-900 font-bold focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer shadow-inner"
              >
                {CPC_SECTIONS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none group-hover:text-zinc-900 transition-colors" size={18} />
            </div>
          </div>
        )}

        {/* 2. Main Search Input Group */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
            <Search size={12} className="text-blue-600" />
            {searchType === "keyword" ? "Keyword Search" : "Reference Number"}
          </label>

          <div className="flex flex-col md:flex-row items-stretch gap-3">
            <div className="relative flex-1 group">
              {/* 입력 필드 포커스 시 배경 글로우 */}
              <div className="absolute -inset-1 bg-blue-600/5 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity blur-lg" />

              <div className="relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-300 group-focus-within:text-blue-600 transition-colors" size={22} />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                  placeholder={getPlaceholder()}
                  disabled={loading}
                  className="w-full pl-16 pr-6 py-5 bg-zinc-50 border-none rounded-[1.5rem] focus:bg-white focus:ring-4 focus:ring-blue-50 outline-none transition-all text-lg font-black text-zinc-900 placeholder:text-zinc-200 shadow-inner"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !keyword.trim()}
              className="px-10 py-5 bg-zinc-900 text-white font-black text-lg rounded-[1.5rem] shadow-xl hover:bg-black disabled:bg-zinc-100 disabled:text-zinc-300 disabled:shadow-none transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 min-w-[160px] group"
            >
              {loading ? (
                <>
                  <Loader2 size={24} className="animate-spin text-zinc-500" />
                  <span className="tracking-tighter">분석 중</span>
                </>
              ) : (
                <>
                  <span className="tracking-tighter font-black">검색</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Bottom Info Bar */}
      <div className="flex items-center gap-4 p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 transition-colors hover:bg-blue-50">
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-blue-600 shadow-sm shrink-0">
          <Info size={16} />
        </div>
        <p className="text-xs font-bold text-blue-700/80 leading-relaxed">
          {getHelperText()}
        </p>
      </div>
    </div>
  );
}

