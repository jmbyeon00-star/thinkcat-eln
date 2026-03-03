import React from 'react';
import { Trash2, X, RotateCcw, Trash } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';

interface TrashBinProps {
    isOpen: boolean;
    onClose: () => void;
}

export const TrashBin = ({ isOpen, onClose }: TrashBinProps) => {
    const { hiddenPatents, restorePatent, clearHiddenPatents } = useSearchContext();

    if (!isOpen) return null;

    return (
        <>
            {/* 오버레이 */}
            <div
                className="fixed inset-0 bg-black/30 z-[150] transition-opacity"
                onClick={onClose}
            />

            {/* 패널 */}
            <div className="fixed left-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[150] flex flex-col animate-in slide-in-from-left duration-300">
                {/* 헤더 */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-700 to-slate-800">
                    <div className="flex items-center gap-3">
                        <Trash2 size={22} className="text-white" />
                        <h2 className="text-lg font-black text-white">휴지통</h2>
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-bold text-white">
                            {hiddenPatents.length}건
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-xl transition-all text-white"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 내용 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {hiddenPatents.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            <Trash size={48} className="mx-auto mb-4 text-slate-200" />
                            <p className="font-bold">휴지통이 비어있습니다</p>
                            <p className="text-sm mt-1">삭제된 검색 결과가 여기에 표시됩니다</p>
                        </div>
                    ) : (
                        hiddenPatents.map((patent) => (
                            <div
                                key={patent.application_number}
                                className="bg-slate-50 p-4 rounded-xl border border-slate-100 group hover:border-slate-200 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-slate-400 font-bold mb-1">
                                            #{patent.application_number}
                                        </p>
                                        <h4 className="text-sm font-bold text-slate-700 line-clamp-2">
                                            {patent.title}
                                        </h4>
                                        <p className="text-[10px] text-slate-400 mt-2">
                                            삭제됨: {new Date(patent.hiddenAt).toLocaleString('ko-KR')}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => restorePatent(patent.application_number)}
                                        className="p-2 bg-white hover:bg-green-50 hover:text-green-600 rounded-xl border border-slate-200 hover:border-green-200 transition-all text-slate-500 flex items-center gap-1.5"
                                        title="복원"
                                    >
                                        <RotateCcw size={14} />
                                        <span className="text-xs font-bold">복원</span>
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* 푸터 */}
                {hiddenPatents.length > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50">
                        <button
                            onClick={clearHiddenPatents}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <RotateCcw size={18} />
                            전체 복원
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};
