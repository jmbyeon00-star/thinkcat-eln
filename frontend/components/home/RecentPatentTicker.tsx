"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, X, FileText, Calendar, Building2, Hash, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { getRecentPatents } from "@/lib/api";

interface RecentPatent {
  application_number: string;
  publication_number: string | null;
  open_date: string | null;
  filing_date: string | null;
  title: string | null;
  abstract: string | null;
  ipc_code: string | null;
  applicant_name: string | null;
  end_status: string | null;
}

// IPC 코드 첫 글자(섹션) 기준 분야 매핑
const IPC_SECTION_LABEL: Record<string, string> = {
  A: "생활필수품",
  B: "처리조작·운송",
  C: "화학·야금",
  D: "섬유·종이",
  E: "고정구조물",
  F: "기계공학",
  G: "물리학",
  H: "전기",
};

// 분야별 배지/탭 색상 (텍스트, 배경, 활성 탭 배경)
const IPC_SECTION_COLOR: Record<string, { text: string; bg: string; active: string }> = {
  A: { text: "text-rose-600", bg: "bg-rose-50", active: "bg-rose-500" },
  B: { text: "text-orange-600", bg: "bg-orange-50", active: "bg-orange-500" },
  C: { text: "text-amber-600", bg: "bg-amber-50", active: "bg-amber-500" },
  D: { text: "text-emerald-600", bg: "bg-emerald-50", active: "bg-emerald-500" },
  E: { text: "text-teal-600", bg: "bg-teal-50", active: "bg-teal-500" },
  F: { text: "text-cyan-600", bg: "bg-cyan-50", active: "bg-cyan-500" },
  G: { text: "text-indigo-600", bg: "bg-indigo-50", active: "bg-indigo-500" },
  H: { text: "text-violet-600", bg: "bg-violet-50", active: "bg-violet-500" },
};
const IPC_SECTION_COLOR_DEFAULT = { text: "text-zinc-500", bg: "bg-zinc-100", active: "bg-zinc-500" };

function getIpcSection(ipcCode: string | null): string | null {
  if (!ipcCode) return null;
  const main = ipcCode.split("|")[0]?.trim();
  const letter = main?.[0]?.toUpperCase();
  return letter && IPC_SECTION_LABEL[letter] ? letter : null;
}

function getIpcFieldLabel(ipcCode: string | null): string {
  const section = getIpcSection(ipcCode);
  return section ? IPC_SECTION_LABEL[section] : "분야 미분류";
}

function getIpcFieldColor(ipcCode: string | null) {
  const section = getIpcSection(ipcCode);
  return section ? IPC_SECTION_COLOR[section] : IPC_SECTION_COLOR_DEFAULT;
}

function formatDate(raw: string | null): string {
  if (!raw || raw.length < 8) return "-";
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
}

const ITEM_HEIGHT = 48; // px
const VISIBLE_COUNT = 4;
const HEADER_HEIGHT = 48; // px - R&D공고 신착 카드 헤더와 높이를 맞춤

export default function RecentPatentTicker() {
  const [patents, setPatents] = useState<RecentPatent[]>([]);
  const [selected, setSelected] = useState<RecentPatent | null>(null);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getRecentPatents(20)
      .then((res: any) => setPatents(res?.items || []))
      .catch((err) => console.error("신착특허 로드 실패:", err));
  }, []);

  // 실제 존재하는 IPC 분야만 탭으로 노출 (전체 탭은 항상 표시)
  const availableSections = useMemo(() => {
    const sections = new Set<string>();
    patents.forEach((p: RecentPatent) => {
      const s = getIpcSection(p.ipc_code);
      if (s) sections.add(s);
    });
    return Array.from(sections).sort();
  }, [patents]);

  const filteredPatents = useMemo(() => {
    if (activeTab === "ALL") return patents;
    return patents.filter((p: RecentPatent) => getIpcSection(p.ipc_code) === activeTab);
  }, [patents, activeTab]);

  // 탭 줄이 실제로 더 스크롤할 수 있는 상태인지 체크 (끝까지 스크롤하면 화살표 힌트를 숨김)
  const checkTabsScroll = () => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4);
  };

  useEffect(() => {
    checkTabsScroll();
  }, [availableSections]);

  if (patents.length === 0) return null;

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div
          className="flex items-center gap-2 px-5 border-b border-zinc-100 bg-blue-50/50"
          style={{ height: HEADER_HEIGHT }}
        >
          <Sparkles size={14} className="text-blue-600 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-600 shrink-0">신착특허</span>
          <span className="text-[11px] font-bold text-blue-400 shrink-0">{patents.length}건</span>

          {/* IPC 분야 탭 - 마우스 오버하면 해당 분야 목록으로 전환. 제목/건수는 고정, 탭만 가로 스크롤 */}
          <div className="relative flex-1 min-w-0 h-full ml-2">
            <div
              ref={tabsScrollRef}
              onScroll={checkTabsScroll}
              className="flex items-stretch h-full overflow-x-auto scrollbar-none border-l border-blue-100"
            >
              <button
                onMouseEnter={() => setActiveTab("ALL")}
                onClick={() => setActiveTab("ALL")}
                className={`px-2.5 text-[11px] font-bold whitespace-nowrap transition-colors shrink-0 border-r border-blue-100 border-b-2 ${
                  activeTab === "ALL"
                    ? "border-b-blue-600 text-blue-600 bg-white"
                    : "border-b-transparent text-zinc-400 hover:bg-white/60"
                }`}
              >
                전체
              </button>
              {availableSections.map((section: string) => {
                const color = IPC_SECTION_COLOR[section] ?? IPC_SECTION_COLOR_DEFAULT;
                return (
                  <button
                    key={section}
                    onMouseEnter={() => setActiveTab(section)}
                    onClick={() => setActiveTab(section)}
                    className={`px-2.5 text-[11px] font-bold whitespace-nowrap transition-colors shrink-0 border-r border-blue-100 border-b-2 ${
                      activeTab === section
                        ? `border-b-current bg-white ${color.text}`
                        : "border-b-transparent text-zinc-400 hover:bg-white/60"
                    }`}
                  >
                    {IPC_SECTION_LABEL[section]}
                  </button>
                );
              })}
            </div>

            {/* 탭이 더 있다는 힌트 - 끝까지 스크롤하면 사라짐 */}
            {canScrollRight && (
              <div className="absolute top-0 right-0 h-full w-6 bg-gradient-to-l from-white via-white/70 to-transparent pointer-events-none flex items-center justify-end">
                <ChevronRight size={12} className="text-blue-400" />
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          {filteredPatents.length === 0 ? (
            <div
              className="flex items-center justify-center text-xs text-zinc-400 font-medium"
              style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
            >
              해당 분야의 신착특허가 없습니다
            </div>
          ) : (
            <div
              className="overflow-y-auto scrollbar-none"
              style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
            >
              {filteredPatents.map((p: RecentPatent, i: number) => {
                const color = getIpcFieldColor(p.ipc_code);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 px-5 cursor-pointer hover:bg-blue-50/40 transition-colors"
                    style={{ height: ITEM_HEIGHT }}
                    onClick={() => setSelected(p)}
                  >
                    <span
                      className={`text-[11px] font-bold shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5 ${color.text} ${color.bg}`}
                    >
                      {getIpcFieldLabel(p.ipc_code)}
                    </span>
                    <span className="text-zinc-400 text-xs font-bold shrink-0 tabular-nums">
                      {formatDate(p.open_date)}
                    </span>
                    <span className="text-zinc-800 text-sm font-bold truncate flex-1 min-w-0">
                      {p.title || "제목 없음"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* 위/아래 가장자리 페이드 처리 + 아래쪽엔 "더 있음" 표시 */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none flex items-end justify-center pb-0.5">
            {filteredPatents.length > VISIBLE_COUNT && (
              <ChevronDown size={14} className="text-blue-300 animate-bounce" />
            )}
          </div>
        </div>

        <style jsx>{`
          .scrollbar-none::-webkit-scrollbar {
            display: none;
          }
          .scrollbar-none {
            scrollbar-width: none;
          }
        `}</style>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center pt-24 md:pt-32 p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-start gap-4 bg-slate-50">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 shrink-0">
                <Sparkles size={13} />
                <span className="text-[11px] font-black uppercase tracking-wider">신착특허</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 space-y-5 overflow-y-auto">
              <h3 className="text-xl font-black text-slate-900 leading-snug">
                {selected.title || "제목 없음"}
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center gap-2">
                  <Hash size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">출원번호</p>
                    <p className="text-sm font-bold text-slate-800">{selected.application_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">출원일자</p>
                    <p className="text-sm font-bold text-slate-800">{formatDate(selected.filing_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">공개번호</p>
                    <p className="text-sm font-bold text-slate-800">{selected.publication_number || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">공개일자</p>
                    <p className="text-sm font-bold text-slate-800">{formatDate(selected.open_date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Building2 size={14} className="text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">출원인</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selected.applicant_name || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 col-span-2">
                  <Tag size={14} className="text-blue-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">IPC 코드</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{selected.ipc_code || "-"}</p>
                  </div>
                </div>
              </div>

              {selected.abstract && (
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase mb-1.5">요약</p>
                  <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{selected.abstract}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
