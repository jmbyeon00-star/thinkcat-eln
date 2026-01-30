import React from 'react';
import { ArrowUp } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';

interface FixedChatBarProps {
    onSearch: () => void;
    isLoading: boolean;
}

export const FixedChatBar = ({ onSearch, isLoading }: FixedChatBarProps) => {
    const { query, setQuery, searchTab } = useSearchContext();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSearch();
        }
    };

    return (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 w-full max-w-4xl px-6 z-50">
            <div className="bg-[#f0f4f9] rounded-[32px] p-4 shadow-2xl flex items-end gap-2 focus-within:bg-white transition-all border border-transparent focus-within:border-slate-200">
                <textarea
                    rows={3}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={searchTab === 'ai'
                        ? "특허 의도를 입력하세요 (예: 2020년 이후 삼성전자의 자율주행 특허)"
                        : "일반 검색어를 입력하세요"}
                    className="bg-transparent border-none outline-none text-slate-800 text-[17px] font-medium placeholder:text-slate-400 w-full resize-none py-2 px-2"
                />
                <button
                    onClick={() => onSearch()}
                    disabled={isLoading || !query.trim()}
                    className={`w-14 h-12 flex items-center justify-center rounded-full transition-all ${query.trim() && !isLoading
                        ? (searchTab === 'ai' ? 'bg-indigo-600' : 'bg-slate-800') + ' text-white shadow-lg'
                        : 'text-slate-300 bg-transparent'
                        }`}
                >
                    {isLoading ? <span className="animate-spin text-lg">✦</span> : <ArrowUp size={24} strokeWidth={2.5} />}
                </button>
            </div>
        </div>
    );
};