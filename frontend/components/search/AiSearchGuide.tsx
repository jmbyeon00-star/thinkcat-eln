import React from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';

interface AiSearchGuideProps {
    onExampleClick?: (query: string) => void;
}

export const AiSearchGuide = ({ onExampleClick }: AiSearchGuideProps) => {
    // 유저에게 영감을 줄 수 있는 예시 질문들
    const examples = [
        "2020년 이후 출원된 삼성전자의 자율주행 센서 특허",
        "배터리 과열 방지를 위한 냉각 시스템 관련 기술",
        "애플이 등록한 폴더블 디스플레이 힌지 구조",
    ];

    return (
        <div className="flex flex-col items-center text-center px-6 animate-in fade-in zoom-in duration-1000">
            {/* <div className="relative mb-8">
                <div className="absolute -inset-4 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
                <div className="relative p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[2rem] text-white shadow-xl shadow-indigo-200">
                    <Sparkles size={48} strokeWidth={1.5} />
                </div>
            </div> */}

            {/* 메인 타이틀 */}
            <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6">
                어떤 특허를 <span className="text-indigo-600">찾으시나요?</span>
            </h1>
            <p className="text-slate-500 text-lg font-medium">인공지능이 당신의 검색 의도를 완벽하게 이해합니다.</p>

            {/* 예시 칩 섹션: 유저가 클릭해서 바로 검색해볼 수 있게 유도 */}
            <div className="flex flex-col items-center gap-4 w-full max-w-2xl mt-10">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">
                    <Lightbulb size={14} className="text-amber-400" />
                    <span>이렇게 질문해보세요</span>
                </div>

                <div className="flex flex-wrap justify-center gap-3">
                    {examples.map((ex, i) => (
                        <button
                            key={i}
                            onClick={() => onExampleClick?.(ex)}
                            className="px-5 py-2.5 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:shadow-md transition-all active:scale-95"
                        >
                            {ex}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};