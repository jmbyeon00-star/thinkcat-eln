import React, { createContext, useContext, useState, ReactNode } from 'react';
import { SearchOptions, SearchResultItem } from '@/types/search';
import { PaginationSearchResp } from "@lib/types";

interface SearchContextType {
    searchTab: 'ai' | 'standard';
    setSearchTab: (tab: 'ai' | 'standard') => void;
    searchMode: 'chat' | 'keyword';
    setSearchMode: (mode: 'chat' | 'keyword') => void;
    searchType: "keyword" | "application" | "registration";
    setSearchType: (typ: 'keyword' | 'application' | 'registration') => void;
    query: string;
    setQuery: (q: string) => void;
    results: SearchResultItem[];
    setResults: (r: SearchResultItem[]) => void;
    targetKeyword: string;
    setTargetKeyword: (k: string) => void;
    totalHits: number;
    setTotalHits: (n: number) => void;
    options: SearchOptions;
    setOptions: React.Dispatch<React.SetStateAction<SearchOptions>>;
    hasSearched: boolean;
    setHasSearched: (b: boolean) => void;
    currentPage: number;
    setCurrentPage: (p: number) => void;
    keywordCache: Record<string, PaginationSearchResp>;
    setKeywordCache: (key: string, data: PaginationSearchResp) => void;
    lastPages: Record<string, number>;
    setLastPage: (keyword: string, page: number) => void;
    pageSize: number;
    isLoading: boolean;
    setIsLoading: (b: boolean) => void;

    // AI Search specific fields
    selectedPatents: Record<string, SearchResultItem[]>;
    togglePatentSelection: (query: string, patent: any) => void;
    isPatentSelected: (query: string, appNum: string) => boolean;
    clearSelectedPatents: (query?: string) => void;
    submittedQuery: string;
    setSubmittedQuery: (q: string) => void;
    hiddenPatents: any[];
    hidePatent: (patent: any) => void;
    restorePatent: (appNum: string) => void;
    isPatentHidden: (appNum: string) => boolean;
    clearHiddenPatents: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [isLoading, setIsLoading] = useState(false);
    const [pageSize] = useState(10);
    const [lastPages, setLastPages] = useState<Record<string, number>>({});
    const setLastPage = (keyword: string, page: number) => {
        setLastPages(prev => ({ ...prev, [keyword]: page }));
    };

    const [searchTab, setSearchTab] = useState<'ai' | 'standard'>('ai');
    const [searchMode, setSearchMode] = useState<'chat' | 'keyword'>('chat');
    const [searchType, setSearchType] = useState<"keyword" | "application" | "registration">("keyword");
    const [query, setQuery] = useState('');
    const [targetKeyword, setTargetKeyword] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [totalHits, setTotalHits] = useState(0);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [options, setOptions] = useState<SearchOptions>({
        search_type: null,
        use_vector: true,
        filters: { filing_year: { gte: undefined, lte: undefined }, applicant_name: '', inventor_name: '' },
        exact_match: { application_number: '' },
        text_query: { fields: [], keyword: [] },
    });

    const [keywordCache, _setKeywordCache] = useState<Record<string, PaginationSearchResp>>({});

    const setKeywordCache = (key: string, data: PaginationSearchResp) => {
        _setKeywordCache(prev => ({ ...prev, [key]: data }));
    };

    const [selectedPatents, setSelectedPatents] = useState<Record<string, SearchResultItem[]>>({});
    const [submittedQuery, setSubmittedQuery] = useState('');
    const [hiddenPatents, setHiddenPatents] = useState<any[]>([]);

    const togglePatentSelection = (query: string, patent: any) => {
        const _patent = patent._source ? patent : { _source: patent }; // Ensure it has _source
        const appNum = _patent._source.application_number ?? _patent._source.address;
        if (!appNum) return;

        setSelectedPatents(prev => {
            const currentSelected = prev[query] || [];
            const isSelected = currentSelected.some(p => (p._source.application_number ?? p._source.address) === appNum);

            if (isSelected) {
                return {
                    ...prev,
                    [query]: currentSelected.filter(p => (p._source.application_number ?? p._source.address) !== appNum)
                };
            } else {
                return {
                    ...prev,
                    [query]: [...currentSelected, _patent as SearchResultItem]
                };
            }
        });
    };

    const isPatentSelected = (query: string, appNum: string) => {
        return (selectedPatents[query] || []).some(p => (p._source.application_number ?? p._source.address) === appNum);
    };

    const clearSelectedPatents = (query?: string) => {
        if (query) {
            setSelectedPatents(prev => ({ ...prev, [query]: [] }));
        } else {
            setSelectedPatents({});
        }
    };

    const hidePatent = (patent: any) => {
        const _patent = patent._source ? patent._source : patent;
        const appNum = _patent.application_number ?? _patent.address;
        if (!appNum) return;

        if (!hiddenPatents.some(p => (p.application_number ?? p.address) === appNum)) {
            setHiddenPatents(prev => [...prev, { ..._patent, hiddenAt: new Date().toISOString() }]);
        }
    };

    const restorePatent = (appNum: string) => {
        setHiddenPatents(prev => prev.filter(p => (p.application_number ?? p.address) !== appNum));
    };

    const isPatentHidden = (appNum: string) => hiddenPatents.some(p => (p.application_number ?? p.address) === appNum);

    const clearHiddenPatents = () => setHiddenPatents([]);

    return (
        <SearchContext.Provider value={{
            searchTab, setSearchTab, searchMode, setSearchMode, searchType, setSearchType,
            query, setQuery, results, setResults, targetKeyword, setTargetKeyword,
            totalHits, setTotalHits, options, setOptions, hasSearched, setHasSearched,
            currentPage, setCurrentPage, keywordCache, setKeywordCache, pageSize, lastPages, setLastPage, isLoading, setIsLoading,
            selectedPatents, togglePatentSelection, isPatentSelected, clearSelectedPatents, submittedQuery, setSubmittedQuery,
            hiddenPatents, hidePatent, restorePatent, isPatentHidden, clearHiddenPatents
        }}>
            {children}
        </SearchContext.Provider>
    );
}

export const useSearchContext = () => {
    const context = useContext(SearchContext);
    if (!context) throw new Error("useSearchContext는 SearchProvider 내부에서 사용해야 합니다.");
    return context;
};