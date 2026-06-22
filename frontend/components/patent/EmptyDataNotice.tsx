import { LucideIcon, Info } from "lucide-react";

interface EmptyDataNoticeProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

/**
 * 특허 상세페이지의 AI 분석 섹션(피인용수 예측/네비게이션/추천 등)에서
 * 데이터가 없을 때 공통으로 쓰는 안내 화면.
 */
export default function EmptyDataNotice({ icon: Icon, title, description }: EmptyDataNoticeProps) {
  return (
    <div className="w-full py-16 px-10 text-center bg-slate-50 rounded-[1.5rem] border border-dashed border-slate-200">
      <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-slate-100">
        <Icon className="text-slate-300" size={28} />
      </div>
      <p className="text-slate-600 font-bold text-base mb-2">{title}</p>
      {description && (
        <div className="flex flex-col items-center gap-1.5 max-w-md mx-auto">
          <Info size={14} className="text-slate-300" />
          <p className="text-slate-400 text-sm leading-relaxed text-center whitespace-pre-line">{description}</p>
        </div>
      )}
    </div>
  );
}
