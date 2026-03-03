import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getSearchHistory, deleteSearchHistoryItem, SearchQueryHistoryItem } from '@/lib/searchHistoryApi';
import { History, X, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SearchHistoryListProps {
    onSelectHistoryItem: (query: string, searchType: string) => void;
    onClose: () => void;
}

export const SearchHistoryList: React.FC<SearchHistoryListProps> = ({ onSelectHistoryItem, onClose }) => {
    const { data: session } = useSession();
    const token = session?.access_token;
    const [history, setHistory] = useState<SearchQueryHistoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                setIsLoading(true);
                const fetchedHistory = await getSearchHistory(token);
                setHistory(fetchedHistory);
            } catch (err) {
                console.error("Failed to fetch search history:", err);
                setError("검색 기록을 불러오는 데 실패했습니다.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchHistory();
    }, [token]);

    const handleItemClick = (item: SearchQueryHistoryItem) => {
        onSelectHistoryItem(item.query, item.search_type);
        onClose(); // Close the history list after selecting an item
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation(); // 부모 버튼의 클릭 이벤트 전파 방지
        if (!token) return;

        if (confirm("정말 이 검색 기록을 삭제하시겠습니까?")) {
            try {
                await deleteSearchHistoryItem(id, token);
                setHistory(prev => prev.filter(item => item.id !== id));
            } catch (err) {
                console.error("Failed to delete history item:", err);
                alert("삭제에 실패했습니다.");
            }
        }
    };

    // 드래그 관련 상태
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = React.useRef({ x: 0, y: 0 });
    const positionRef = React.useRef({ x: 0, y: 0 });



    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        positionRef.current = { ...position }; // 현재 위치 기준
    };

    // useEffect 다시 작성 (위의 내부 로직 교체)
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;
            setPosition({
                x: positionRef.current.x + dx,
                y: positionRef.current.y + dy
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);


    const getSearchTypeLabel = (searchType: string) => {
        switch (searchType) {
            case 'ai':
                return 'AI 검색';
            case 'standard':
                return '키워드 재검색';
            case 'similar':
                return '유사 특허 검색';
            default:
                return '기록';
        }
    };

    return (
        <div
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
            // className="fixed right-10 bottom-24 w-80 h-[500px] max-h-[calc(100vh-10rem)] bg-white border border-slate-200 rounded-2xl shadow-xl p-6 flex flex-col z-50 animate-in slide-in-from-bottom-2 duration-300 transition-none"
            className="fixed right-10 bottom-80 w-80 h-[500px] max-h-[calc(100vh-16rem)] bg-white border border-slate-200 rounded-2xl shadow-xl p-6 flex flex-col z-50 animate-in slide-in-from-bottom-2 duration-300 transition-none"
        >
            <div
                onMouseDown={handleMouseDown}
                className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4 cursor-grab active:cursor-grabbing select-none"
            >
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 pointer-events-none">
                    <History size={20} className="text-slate-500" /> 검색 기록
                </h3>
                <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-500">
                    <X size={20} />
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center items-center h-full text-slate-500">
                    기록 불러오는 중...
                </div>
            ) : error ? (
                <div className="flex justify-center items-center h-full text-red-500">
                    {error}
                </div>
            ) : history.length === 0 ? (
                <div className="flex justify-center items-center h-full text-slate-500">
                    검색 기록이 없습니다.
                </div>
            ) : (
                <ul className="flex-1 overflow-y-auto pr-2 -mr-2">
                    {history.map((item) => (
                        <li key={item.id} className="mb-3 relative group">
                            <button
                                onClick={() => handleItemClick(item)}
                                className="w-full text-left p-3 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors border border-slate-100"
                            >
                                <div className="text-sm font-semibold text-slate-700 leading-tight mb-1">
                                    {item.query}
                                </div>
                                <div className="flex justify-between items-center text-xs text-slate-500">
                                    <span className="font-medium text-indigo-600 px-2 py-0.5 bg-indigo-50 rounded-full">
                                        {getSearchTypeLabel(item.search_type)}
                                    </span>
                                    <span>
                                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ko })}
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={(e) => handleDelete(e, item.id)}
                                className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                title="삭제"
                            >
                                <Trash2 size={14} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};