"use client";
import { useEffect, useRef, useState } from "react";
import { Megaphone } from "lucide-react";
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
const VISIBLE_COUNT = 3;
const SCROLL_STEP_MS = 30;
const SCROLL_STEP_PX = 0.25;

export default function RecentAnnouncementTicker() {
  const [items, setItems] = useState<RecentAnnouncement[]>([]);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef = useRef(0);

  useEffect(() => {
    getRecentAnnouncements(10)
      .then((res: any) => setItems(res?.items || []))
      .catch((err) => console.error("신착 R&D공고 로드 실패:", err));
  }, []);

  useEffect(() => {
    if (paused || items.length === 0) return;
    const el = trackRef.current;
    if (!el) return;
    posRef.current = el.scrollTop;
    const timer = setInterval(() => {
      posRef.current += SCROLL_STEP_PX;
      if (posRef.current >= el.scrollHeight / 2) {
        posRef.current = 0;
      }
      el.scrollTop = Math.round(posRef.current);
    }, SCROLL_STEP_MS);
    return () => clearInterval(timer);
  }, [paused, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-zinc-100 bg-blue-50/50">
        <Megaphone size={14} className="text-blue-600" />
        <span className="text-[11px] font-black uppercase tracking-wider text-blue-600">R&D공고 신착</span>
        <span className="text-[11px] font-bold text-blue-400">{items.length}건</span>
      </div>

      <div className="relative">
        <div
          ref={trackRef}
          className="overflow-y-auto scrollbar-none"
          style={{ height: ITEM_HEIGHT * VISIBLE_COUNT }}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {[...items, ...items].map((a, i) => (
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
  );
}
