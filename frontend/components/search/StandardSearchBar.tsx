import { useState, FormEvent, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, ChevronDown, ArrowRight, Check } from "lucide-react";

type Props = {
  loading: boolean;
  onSearch: (params: { keyword: string; category: string }) => void;
  searchType?: "keyword" | "application" | "registration";
  initialKeyword?: string;
  initialCategory?: string;
};

export function StandardSearchBar({
  loading,
  onSearch,
  searchType = "keyword",
  initialKeyword = "",
  initialCategory = "all",
}: Props) {
  const translator = useTranslations();

  const CPC_SECTIONS = [
    { value: "all", label: translator("common.cpc_sections.all") },
    { value: "a", label: translator("common.cpc_sections.A") },
    { value: "b", label: translator("common.cpc_sections.B") },
    { value: "c", label: translator("common.cpc_sections.C") },
    { value: "d", label: translator("common.cpc_sections.D") },
    { value: "e", label: translator("common.cpc_sections.E") },
    { value: "f", label: translator("common.cpc_sections.F") },
    { value: "g", label: translator("common.cpc_sections.G") },
    { value: "h", label: translator("common.cpc_sections.H") },
    { value: "y", label: translator("common.cpc_sections.Y") },
  ];

  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState(initialCategory);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // searchType이 바뀔 때마다 입력창 초기화
  useEffect(() => {
    setKeyword(initialKeyword);
  }, [searchType, initialKeyword]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!keyword.trim()) return;
    onSearch({
      keyword: keyword.trim(),
      category: searchType === "keyword" ? category : "",
    });
  };

  const selectedCategoryLabel =
    CPC_SECTIONS.find((s) => s.value === category)?.label || "전체 카테고리";

  const getPlaceholder = () => {
    switch (searchType) {
      case "application": return translator("search.standard.placeholder.application");
      case "registration": return translator("search.standard.placeholder.registration");
      default: return translator("search.standard.placeholder.keyword");
    }
  };

  return (
    <div className="w-full space-y-6 text-left animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          {searchType === "keyword" ? "카테고리 및 자연어 검색" : "특허 참조 번호 사용"}
        </label>

        <div className="flex flex-col md:flex-row items-stretch gap-3">
          {/* 입력 영역 */}
          <div className="relative flex-1 flex flex-col md:flex-row items-stretch bg-slate-50 border border-slate-200 rounded-[2rem] overflow-visible focus-within:ring-4 focus-within:ring-blue-600/5 focus-within:border-blue-600/30 transition-all duration-300 group">

            {/* 카테고리 커스텀 드롭다운 */}
            {searchType === "keyword" && (
              <div className="relative min-w-[200px]" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center justify-between w-full h-full px-6 py-4 md:py-0 text-left transition-colors rounded-l-[2rem] border-b md:border-b-0 md:border-r border-slate-200/60 hover:bg-slate-100/50 ${isDropdownOpen ? "bg-white" : ""}`}
                >
                  <span className="text-slate-900 font-bold text-[13px] truncate">
                    {selectedCategoryLabel}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180 text-blue-600" : ""}`}
                  />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-[110%] left-0 w-full md:w-[240px] bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl py-2 z-[100] animate-in fade-in zoom-in-95 duration-200 origin-top">
                    <div className="max-h-[320px] overflow-y-auto">
                      {CPC_SECTIONS.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => {
                            setCategory(s.value);
                            setIsDropdownOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-5 py-3 text-[13px] font-bold transition-all hover:bg-slate-50 ${category === s.value
                            ? "text-blue-600 bg-blue-50/30"
                            : "text-slate-600"
                            }`}
                        >
                          {s.label}
                          {category === s.value && <Check size={14} strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 키워드 입력 */}
            <div className="relative flex-1">
              <Search
                size={20}
                className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-600 transition-colors"
              />
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder={getPlaceholder()}
                disabled={loading}
                className="w-full pl-14 pr-6 py-5 bg-transparent border-none outline-none text-[17px] font-bold text-slate-900 placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* 검색 버튼 */}
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !keyword.trim()}
            className="px-10 py-5 bg-slate-900 text-white font-black text-lg rounded-[2rem] shadow-lg hover:bg-blue-600 disabled:bg-slate-100 disabled:text-slate-300 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 min-w-[140px] group"
          >
            {loading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <span>검색</span>
                <ArrowRight size={20} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}