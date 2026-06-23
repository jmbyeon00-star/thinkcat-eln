"use client";
import { useEffect, useState } from "react";
import { Megaphone, ChevronDown } from "lucide-react";
import { getRecentAnnouncements } from "@/lib/api";

interface RecentAnnouncement {
  id: number;
  organization: string;
  title: string;
  URL: string;
  announcement_date: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  budget: string | null;
}

function formatDate(raw: string | null): string {
  if (!raw) return "-";
  return raw.slice(0, 10).replace(/-/g, ".");
}

const ITEM_HEIGHT = 48; // px
const VISIBLE_COUNT = 4;
const HEADER_HEIGHT = 48; // px - 신착특허 카드 헤더와 높이를 맞춤

export default function RecentAnnouncementTicker() {
  const [items, setItems] = useState<RecentAnnouncement[]>([]);

  useEffect(() => {
    getRecentAnnouncements(10)
      .then((res: any) => setItems(res?.items || []))
      .catch((err) => console.error("신규 R&D공고 로드 실패:", err));
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div
        className="flex items-center gap-2 px-5 border-b border-zinc-100 bg-blue-50/50"
        style={{ height: HEADER_HEIGHT }}
      >
        <Megaphone size={14} className="text-blue-600" />
        <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">신규R&D공고</span>
        <span className="text-[11px] font-bold text-blue-400">{items.length}건</span>
      </div>

      <div className="relative">
        <div
          className="overflow-y-auto scrollbar-none"
          style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
        >
          {items.map((a, i) => (
            <a
              key={i}
              href={a.URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-5 cursor-pointer hover:bg-blue-50/40 transition-colors"
              style={{ height: ITEM_HEIGHT }}
            >
              <span className="text-zinc-400 text-xs font-bold shrink-0 tabular-nums">
                {formatDate(a.announcement_date)}
              </span>
              <span className="text-zinc-400 text-xs font-bold shrink-0 truncate max-w-[90px]">
                {a.organization}
              </span>
              <span className="text-zinc-800 text-sm font-bold truncate flex-1 min-w-0">
                {a.title}
              </span>
            </a>
          ))}
        </div>

        <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-white to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none flex items-end justify-center pb-0.5">
          {items.length > VISIBLE_COUNT && (
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
  );
}
