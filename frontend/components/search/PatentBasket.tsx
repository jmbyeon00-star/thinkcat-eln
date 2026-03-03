import React, { useState } from 'react';
import { FileText, X, Trash2, ChevronDown, ChevronUp, ExternalLink, Search, Sparkles, Zap, Scale } from 'lucide-react';
import { useSearchContext } from '@/contexts/SearchContext';
import { useRouter } from '@/routing';
import { useSession } from 'next-auth/react';

// 유사 특허 검색 방법 타입
type SimilarSearchMethod = 'centroid' | 'script_score' | 'weighted';

interface PatentBasketProps {
    isOpen: boolean;
    onClose: () => void;
    onSimilarSearch?: (method: SimilarSearchMethod, patents: any[]) => void;
}

export const PatentBasket = ({ isOpen, onClose, onSimilarSearch }: PatentBasketProps) => {
    const router = useRouter();
    const { data: session } = useSession();
    const [expandedQueries, setExpandedQueries] = useState<Record<string, boolean>>({});
    const [searchMethod, setSearchMethod] = useState<SimilarSearchMethod>('centroid');
    const [isSearching, setIsSearching] = useState(false);
    const [isSimilarSearchExpanded, setIsSimilarSearchExpanded] = useState(false);
    const [showSimilarSearchConfirm, setShowSimilarSearchConfirm] = useState(false);
    const { selectedPatents, togglePatentSelection, clearSelectedPatents, setOptions } = useSearchContext();

    // 전체 선택된 특허 수
    const totalCount = Object.values(selectedPatents).reduce((sum, arr) => sum + arr.length, 0);

    // 모든 선택된 특허를 flat array로
    const allSelectedPatents = Object.values(selectedPatents).flat();

    // 유사 특허 검색 실행 (확인 모달 열기)
    const handleSimilarSearch = () => {
        if (allSelectedPatents.length === 0) return;
        setShowSimilarSearchConfirm(true);
    };

    // 실제 검색 실행
    const executeSimilarSearch = async () => {
        setShowSimilarSearchConfirm(false);
        setIsSearching(true);
        try {
            if (onSimilarSearch) {
                // 유사 검색 시 기존 필터 초기화
                setOptions(prev => ({
                    ...prev,
                    filters: { filing_year: { gte: undefined, lte: undefined }, applicant_name: '', inventor_name: '' },
                    exact_match: { application_number: '' },
                    text_query: { fields: [], keyword: [] },
                }));
                onSimilarSearch(searchMethod, allSelectedPatents);
            }
        } finally {
            setIsSearching(false);
        }
    };

    // 검색어 목록
    const queries = Object.keys(selectedPatents).filter(q => selectedPatents[q].length > 0);

    // 검색어별 펼침/접힘 토글
    const toggleExpand = (query: string) => {
        setExpandedQueries(prev => ({ ...prev, [query]: !prev[query] }));
    };

    // 개별 특허 삭제
    const handleRemovePatent = (query: string, patent: any) => {
        togglePatentSelection(query, patent);
    };

    // 상세 페이지로 이동
    const goToDetail = (appNum: string) => {
        router.push(`/applicationNum/${appNum}`);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* 오버레이 */}
            <div
                className="fixed inset-0 bg-black/30 z-[150] transition-opacity"
                onClick={onClose}
            />

            {/* 패널 */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[150] flex flex-col">
                {/* 헤더 */}
                <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-indigo-700">
                    <div className="flex items-center gap-3">
                        <FileText size={22} className="text-white" />
                        <h2 className="text-lg font-black text-white">아티팩트</h2>
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-bold text-white">
                            {totalCount}건
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
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {queries.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                            선택한 특허가 없습니다
                        </div>
                    ) : (
                        queries.map(query => {
                            const patents = selectedPatents[query];
                            const isExpanded = expandedQueries[query] !== false; // 기본 펼침

                            return (
                                <div key={query} className="bg-slate-50 rounded-2xl overflow-hidden">
                                    {/* 검색어 헤더 */}
                                    <div
                                        onClick={() => toggleExpand(query)}
                                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            <span className="font-bold text-slate-700 truncate">"{query}"</span>
                                            <span className="shrink-0 px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full text-xs font-bold">
                                                {patents.length}건
                                            </span>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                clearSelectedPatents(query);
                                            }}
                                            className="p-1.5 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-all text-slate-400"
                                            title="전체 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    {/* 특허 목록 */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 space-y-2">
                                            {patents.map((patent, idx) => (
                                                <div
                                                    key={patent._source.application_number}
                                                    className="bg-white p-3 rounded-xl border border-slate-100 group"
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[10px] font-bold text-slate-400 font-mono">
                                                                    #{patent._source.application_number}
                                                                </span>
                                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${patent._source.end_status === "등록"
                                                                    ? "bg-emerald-50 text-emerald-600"
                                                                    : "bg-slate-50 text-slate-600"
                                                                    }`}>
                                                                    {patent._source.end_status}
                                                                </span>
                                                            </div>
                                                            <h4 className="text-xs font-bold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                                                                {patent._source.title}
                                                            </h4>
                                                            <p className="text-xs text-slate-500 line-clamp-2 italic">
                                                                {patent._source.abstract?.substring(0, 100)}...
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={() => patent._source.application_number && goToDetail(patent._source.application_number)}
                                                                className="p-1.5 hover:bg-indigo-100 hover:text-indigo-600 rounded-lg transition-all text-slate-400"
                                                                title="상세 보기"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleRemovePatent(query, patent)}
                                                                className="p-1.5 hover:bg-rose-100 hover:text-rose-600 rounded-lg transition-all text-slate-400"
                                                                title="삭제"
                                                            >
                                                                <X size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 푸터 */}
                {totalCount > 0 && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-4">
                        {/* 유사 특허 검색 섹션 */}
                        <div className="bg-white rounded-2xl border border-indigo-100 overflow-hidden">
                            {/* 접기/펼치기 헤더 */}
                            <div
                                onClick={() => setIsSimilarSearchExpanded(!isSimilarSearchExpanded)}
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Sparkles size={16} className="text-indigo-500" />
                                    <span className="text-sm font-black text-slate-700">유사 특허 검색</span>
                                </div>
                                {isSimilarSearchExpanded ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                            </div>

                            {/* 검색 방법 선택 (접히는 영역) */}
                            {isSimilarSearchExpanded && (
                                <div className="px-4 pb-4 space-y-3">
                                    <div className="space-y-2">
                                        <label
                                            onClick={() => setSearchMethod('centroid')}
                                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${searchMethod === 'centroid'
                                                ? 'bg-indigo-50 border-2 border-indigo-500'
                                                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${searchMethod === 'centroid' ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                                                }`}>
                                                {searchMethod === 'centroid' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Scale size={14} className="text-indigo-500" />
                                                    <span className="text-sm font-bold text-slate-700">균형 검색</span>
                                                    <span className="text-[10px] font-bold text-indigo-500 bg-indigo-100 px-1.5 py-0.5 rounded">추천</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    선택한 특허들의 평균 벡터로 검색. 빠르고 균형 잡힌 결과.
                                                </p>
                                            </div>
                                        </label>

                                        <label
                                            onClick={() => setSearchMethod('script_score')}
                                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${searchMethod === 'script_score'
                                                ? 'bg-amber-50 border-2 border-amber-500'
                                                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${searchMethod === 'script_score' ? 'border-amber-500 bg-amber-500' : 'border-slate-300'
                                                }`}>
                                                {searchMethod === 'script_score' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Search size={14} className="text-amber-500" />
                                                    <span className="text-sm font-bold text-slate-700">정밀 검색</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    각 특허별 유사도를 합산. 정확하지만 다소 느림.
                                                </p>
                                            </div>
                                        </label>

                                        <label
                                            onClick={() => setSearchMethod('weighted')}
                                            className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all ${searchMethod === 'weighted'
                                                ? 'bg-emerald-50 border-2 border-emerald-500'
                                                : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                                                }`}
                                        >
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${searchMethod === 'weighted' ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300'
                                                }`}>
                                                {searchMethod === 'weighted' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <Zap size={14} className="text-emerald-500" />
                                                    <span className="text-sm font-bold text-slate-700">첫 번째 우선</span>
                                                </div>
                                                <p className="text-[11px] text-slate-500 mt-1">
                                                    첫 번째 선택 특허에 높은 가중치 부여.
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    {/* 유사 특허 찾기 버튼 */}
                                    <button
                                        onClick={handleSimilarSearch}
                                        disabled={isSearching}
                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSearching ? (
                                            <>
                                                <span className="animate-spin">✦</span>
                                                검색 중...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} />
                                                유사 특허 찾기
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 전체 비우기 버튼 */}
                        <button
                            onClick={() => clearSelectedPatents()}
                            className="w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl transition-all"
                        >
                            전체 비우기
                        </button>
                    </div>
                )}
            </div>

            {/* 유사 특허 검색 확인 모달 */}
            {showSimilarSearchConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* 모달 백그라운드 오버레이 */}
                    <div
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                        onClick={() => setShowSimilarSearchConfirm(false)}
                    />

                    {/* 모달 컨텐츠 */}
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden transform transition-all scale-100">
                        <div className="p-6 text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                                <Sparkles className="text-indigo-600 w-6 h-6" />
                            </div>

                            <h3 className="text-lg font-black text-slate-800">
                                유사 특허 검색을 진행할까요?
                            </h3>

                            <div className="text-sm text-slate-500 space-y-1">
                                <p>선택된 특허들을 기반으로 분석하여</p>
                                <p>내용이 유사한 특허를 정밀하게 검색합니다.</p>
                                <p className="text-xs text-slate-400 pt-2 border-t border-slate-100 mt-2">
                                    * 기존 검색어와 옵션은 무시됩니다.
                                </p>
                            </div>
                        </div>

                        <div className="flex border-t border-slate-100 divide-x divide-slate-100">
                            <button
                                onClick={() => setShowSimilarSearchConfirm(false)}
                                className="flex-1 py-4 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={executeSimilarSearch}
                                className="flex-1 py-4 text-sm font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
                            >
                                검색 시작
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
