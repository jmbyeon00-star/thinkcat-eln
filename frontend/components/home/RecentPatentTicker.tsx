"use client";
import { useEffect, useRef, useState } from "react";
import { Sparkles, X, FileText, Calendar, Building2, Hash, Tag } from "lucide-react";
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

function formatDate(raw: string | null): string {
  if (!raw || raw.length < 8) return "-";
  return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
}

const ITEM_HEIGHT = 48; // px
const VISIBLE_COUNT = 3;
const SCROLL_STEP_MS = 30; // 스크롤 갱신 주기
const SCROLL_STEP_PX = 0.25; // 한 번에 움직이는 픽셀 (작을수록 느리고 부드러움)

export default function RecentPatentTicker() {
  const [patents, setPatents] = useState<RecentPatent[]>([]);
  const [selected, setSelected] = useState<RecentPatent | null>(null);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0); // 소수점까지 누적되는 실제 위치 (scrollTop은 브라우저가 정수로 반올림해버려서 0.25처럼 작은 값은 안 움직임)

  useEffect(() => {
    getRecentPatents(20)
      .then((res: any) => setPatents(res?.items || []))
      .catch((err) => console.error("신착특허 로드 실패:", err));
  }, []);

  // 자동 스크롤 (실제 scrollTop을 움직여서, hover 중엔 마우스로도 직접 스크롤 가능)
  useEffect(() => {
    if (paused || patents.length === 0) return;
    const el = trackRef.current;
    if (!el) return;
    posRef.current = el.scrollTop;
    const timer = setInterval(() => {
      posRef.current += SCROLL_STEP_PX;
      // 리스트를 2벌 이어붙여놨으므로, 절반 지나면 자연스럽게 처음으로 되돌림
      if (posRef.current >= el.scrollHeight / 2) {
        posRef.current = 0;
      }
      el.scrollTop = Math.round(posRef.current);
    }, SCROLL_STEP_MS);
    return () => clearInterval(timer);
  }, [paused, patents.length]);

  if (patents.length === 0) return null;

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 bg-blue-50/50">
          <Sparkles size={14} className="text-blue-600" />
          <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">신착특허</span>
          <span className="text-[11px] font-bold text-blue-400">{patents.length}건</span>
        </div>

        <div className="relative">
          <div
            ref={trackRef}
            className="overflow-y-auto scrollbar-none"
            style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {[...patents, ...patents].map((p, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 cursor-pointer hover:bg-blue-50/40 transition-colors"
                style={{ height: ITEM_HEIGHT }}
                onClick={() => setSelected(p)}
              >
                <span className="text-zinc-400 text-xs font-mono shrink-0">{p.application_number}</span>
                <span className="text-zinc-400 text-xs font-bold shrink-0 tabular-nums">
                  {formatDate(p.open_date)}
                </span>
                <span className="text-zinc-800 text-sm font-bold truncate flex-1 min-w-0">
                  {p.title || "제목 없음"}
                </span>
              </div>
            ))}
          </div>

          {/* 위/아래 가장자리 페이드 처리 */}
          <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-white to-transparent pointer-events-none" />
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
