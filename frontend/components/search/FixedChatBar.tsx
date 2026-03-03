import React, { useState } from 'react';
import { useTranslations } from "next-intl";
import { ArrowUp, ChevronDown, FileText, Settings2, Trash2, Scale, Target, FileStack, History } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';

type SearchMethodType = 'centroid' | 'weighted' | 'script_score';

interface FixedChatBarProps {
    onSearch: () => void;
    isLoading: boolean;
    onOpenBasket: () => void;
    onOpenTrash: () => void;
    onOpenHistory: () => void;
    searchMethod: SearchMethodType;
    onSearchMethodChange: (method: SearchMethodType) => void;
}

export const FixedChatBar = ({ onSearch, isLoading, onOpenBasket, onOpenTrash, onOpenHistory, searchMethod, onSearchMethodChange }: FixedChatBarProps) => {
    const { query, setQuery, searchTab, selectedPatents, hiddenPatents } = useSearchContext();
    const [isToolOpen, setIsToolOpen] = useState(false);
    const [isMethodOpen, setIsMethodOpen] = useState(false);
    const translator = useTranslations();

    // 검색 방식 정보
    const SEARCH_METHODS = {
        centroid: {
            name: translator("search.ai.fixedChatBar.search_method.centroid"),
            shortDesc: translator("search.ai.fixedChatBar.description.centroidShortDesc"),
            desc: translator("search.ai.fixedChatBar.description.centroidDesc"),
            icon: Scale,
            color: 'text-indigo-500',
            bgColor: 'bg-indigo-50',
        },
        weighted: {
            name: translator("search.ai.fixedChatBar.search_method.weighted"),
            shortDesc: translator("search.ai.fixedChatBar.description.weightedShortDesc"),
            desc: translator("search.ai.fixedChatBar.description.weightedDesc"),
            icon: Target,
            color: 'text-amber-500',
            bgColor: 'bg-amber-50',
        },
        script_score: {
            name: translator("search.ai.fixedChatBar.search_method.script_score"),
            shortDesc: translator("search.ai.fixedChatBar.description.script_scoreShortDesc"),
            desc: translator("search.ai.fixedChatBar.description.script_scoreDesc"),
            icon: FileStack,
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-50',
        },
    } as const;

    // 선택된 특허 총 개수
    const totalSelectedCount = (Object.values(selectedPatents) as any[][]).reduce((sum, arr) => sum + arr.length, 0);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSearch();
        }
    };

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-50">
            {/* 선택된 특허 표시 배지 */}
            {totalSelectedCount > 0 && (
                <div className="flex justify-center mb-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-100 border border-indigo-200 rounded-full text-xs font-bold text-indigo-700 shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                        <FileText size={14} />
                        <span>{totalSelectedCount}건의 선택된 특허와 함께 검색</span>
                    </div>
                </div>
            )}
            <div className="bg-[#f0f4f9] rounded-[32px] p-2 shadow-2xl flex flex-col transition-all border border-transparent focus-within:bg-white focus-within:border-slate-200">

                {/* 1. 상단: textarea (가로 전체를 사용) */}
                <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={searchTab === 'ai'
                        ? translator("search.ai.placeholder.fixedChatBar.aiSearch")
                        : translator("search.ai.placeholder.fixedChatBar.standardSearch")
                    }
                    className="bg-transparent border-none outline-none text-slate-800 text-[17px] font-medium placeholder:text-slate-400 w-full resize-none pt-3 px-4 pb-2"
                />

                {/* 2. 하단: 버튼들을 한 줄로 묶고 양 끝으로 보냄 */}
                <div className="flex items-center justify-between px-2 pb-1">

                    {/* [왼쪽 그룹] 도구 옵션 버튼 */}
                    <div className="relative">
                        <button
                            onClick={() => setIsToolOpen(!isToolOpen)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all text-xs font-bold ${isToolOpen ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200/50'
                                }`}
                        >
                            <Settings2 size={16} />
                            <span className="font-black">{translator("search.ai.fixedChatBar.tools")}</span>
                        </button>

                        {/* 도구 팝업 메뉴 */}
                        {isToolOpen && (
                            <div className="absolute bottom-full mb-4 left-0 w-72 bg-white border border-slate-100 rounded-3xl shadow-2xl p-2 z-[60]">
                                <div className="py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">검색 방식</div>
                                {(['centroid', 'weighted', 'script_score'] as const).map((method) => {
                                    const info = SEARCH_METHODS[method];
                                    const Icon = info.icon;
                                    const isSelected = searchMethod === method;
                                    return (
                                        <button
                                            key={method}
                                            onClick={() => { onSearchMethodChange(method); setIsToolOpen(false); }}
                                            className={`w-full flex items-start gap-3 px-3 py-3 rounded-2xl transition-all ${isSelected ? info.bgColor : 'hover:bg-slate-50'}`}
                                        >
                                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                                <Icon size={16} className={info.color} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-700">{info.name}</span>
                                                    <span className="text-[10px] font-bold text-slate-400">{info.shortDesc}</span>
                                                    {isSelected && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-0.5">{info.desc}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                                <div className="h-[1px] bg-slate-100 my-1 mx-2" />
                                <button onClick={() => { onOpenBasket(); setIsToolOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl">
                                    <FileText size={16} className="text-slate-400" />
                                    <span>{translator("search.ai.fixedChatBar.basket")}</span>
                                </button>
                                <button onClick={() => { onOpenTrash(); setIsToolOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-2xl">
                                    <Trash2 size={16} />
                                    <span>{translator("search.ai.fixedChatBar.trash")}</span>
                                </button>
                                <button onClick={() => { onOpenHistory(); setIsToolOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-2xl">
                                    <History size={16} className="text-slate-400" />
                                    <span>{translator("search.ai.fixedChatBar.history")}</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* [오른쪽 그룹] 전송 버튼 */}
                    <button
                        onClick={() => onSearch()}
                        disabled={isLoading || !query.trim()}
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${query.trim() && !isLoading
                            ? (searchTab === 'ai' ? 'bg-indigo-600' : 'bg-slate-800') + ' text-white shadow-lg'
                            : 'text-slate-300 bg-transparent'
                            }`}
                    >
                        {isLoading ? <span className="animate-spin text-sm font-bold">✦</span> : <ArrowUp size={20} strokeWidth={3} />}
                    </button>
                </div>
            </div>

            {/* 채팅 하단: 추가 및 도구 */}
            <div className="flex items-center gap-2 px-2 mt-3">

                {/* 아티팩트 */}
                <button
                    onClick={onOpenBasket}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur-md border border-slate-200 rounded-full hover:bg-white hover:border-indigo-300 transition-all shadow-sm group"
                >
                    <FileText size={14} className="text-slate-500 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-700 whitespace-nowrap">{translator("search.ai.fixedChatBar.basket")}</span>
                    {totalSelectedCount > 0 && (

                        <span className="ml-0.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-black">
                            {totalSelectedCount}
                        </span>
                    )}
                </button>

                {/* 휴지통 */}
                <button
                    onClick={onOpenTrash}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur-md border border-slate-200 rounded-full hover:bg-white hover:border-rose-300 transition-all shadow-sm group"
                >
                    <Trash2 size={14} className="text-slate-500 group-hover:text-rose-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-rose-700 whitespace-nowrap">{translator("search.ai.fixedChatBar.trash")}</span>
                    {hiddenPatents.length > 0 && (
                        <span className="ml-0.5 bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center font-black">
                            {hiddenPatents.length}
                        </span>
                    )}
                </button>

                {/* 기록 */}
                <button
                    onClick={onOpenHistory}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/60 backdrop-blur-md border border-slate-200 rounded-full hover:bg-white hover:border-indigo-300 transition-all shadow-sm group"
                >
                    <History size={14} className="text-slate-500 group-hover:text-indigo-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-700 whitespace-nowrap">{translator("search.ai.fixedChatBar.history")}</span>
                </button>

                <div className="w-[1px] h-4 bg-slate-300 mx-1 flex-shrink-0" />

                {/* 검색 방식 선택 옵션 (Dropdown 형식) */}
                <div className="relative">
                    <button
                        onClick={() => setIsMethodOpen(!isMethodOpen)}
                        className={`flex items-center gap-1.5 px-4 py-2 border rounded-full transition-all shadow-sm ${isMethodOpen ? 'bg-indigo-50 border-indigo-300' : 'bg-white/60 border-slate-200 hover:bg-white'}`}
                    >
                        {React.createElement(SEARCH_METHODS[searchMethod].icon, { size: 14, className: SEARCH_METHODS[searchMethod].color })}
                        <span className="text-xs font-bold text-slate-600">
                            {SEARCH_METHODS[searchMethod].name}
                        </span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isMethodOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isMethodOpen && (
                        <div className="absolute bottom-full mb-3 left-0 bg-white border border-slate-200 rounded-[2rem] shadow-2xl p-2 w-72 animate-in fade-in zoom-in-95 duration-200 z-[60]">
                            <div className="py-2 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">검색 방식 선택</div>
                            {(['centroid', 'weighted', 'script_score'] as const).map((method) => {
                                const info = SEARCH_METHODS[method];
                                const Icon = info.icon;
                                const isSelected = searchMethod === method;
                                return (
                                    <button
                                        key={method}
                                        onClick={() => { onSearchMethodChange(method); setIsMethodOpen(false); }}
                                        className={`w-full flex items-start gap-3 px-3 py-3 rounded-2xl transition-all ${isSelected ? info.bgColor : 'hover:bg-slate-50'}`}
                                    >
                                        <div className={`p-2 rounded-xl ${isSelected ? 'bg-white shadow-sm' : 'bg-slate-100'}`}>
                                            <Icon size={14} className={info.color} />
                                        </div>
                                        <div className="flex-1 text-left">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700">{info.name}</span>
                                                <span className="text-[10px] font-bold text-slate-400">{info.shortDesc}</span>
                                                {isSelected && <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />}
                                            </div>
                                            <p className="text-[10px] text-slate-500 mt-0.5">{info.desc}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
};