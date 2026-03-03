'use client';

import React from 'react';
import { useSearchContext } from '@/contexts/SearchContext';

// 분리한 컴포넌트들 임포트
import { ResultListSection } from '@/components/search/ResultListSection';
import { AiSearchView } from '@/components/search/AiSearchView';
import { StandardSearchView } from '@/components/search/StandardSearchView';
import { useTranslations } from "next-intl";
import { Sparkles, Settings } from "lucide-react";

export default function SearchPage() {
    const {
        searchTab, setSearchTab,
        searchMode, setSearchMode,
        searchType, setSearchType,
        query, setQuery,
        results, setResults,
        targetKeyword, setTargetKeyword,
        totalHits, setTotalHits,
        options, setOptions,
        hasSearched, setHasSearched,
        currentPage, setCurrentPage,
        keywordCache, setKeywordCache,
        isLoading, setIsLoading,
        lastPages, setLastPage,
        pageSize,
    } = useSearchContext();

    const handleTabChange = (tab: 'ai' | 'standard') => {
        if (searchTab === tab) return; // 이미 같은 탭이면 무시

        // 1. 탭 상태 변경
        setSearchTab(tab);

        // 2. 검색 상태 완전 초기화 (데이터 꼬임 방지)
        setResults([]);         // 리스트 비우기
        setTotalHits(0);        // 검색 건수 리셋
        setHasSearched(false);  // 검색 전 상태로 되돌리기 (가이드 페이지 노출)
        setCurrentPage(1);      // 페이지 번호 초기화
        setIsLoading(false);    // 로딩 상태 해제
    };

    const translator = useTranslations();

    return (
        <div className="min-h-screen bg-white font-sans">
            <main className={`flex flex-col items-center w-full transition-all duration-700  ${!hasSearched ? 'pt-28 pb-40' : 'pt-10 pb-60'}`}>

                {/* 탭 스위처 */}
                <div className={`flex bg-slate-100 p-1.5 rounded-2xl mb-8 z-10 transition-all ${!hasSearched ? 'scale-110' : 'scale-100'}`}>
                    <button onClick={() => handleTabChange('ai')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all ${searchTab === 'ai' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Sparkles size={16} /> {translator("search.ai.tab.aiSearch")}
                    </button>
                    <button onClick={() => handleTabChange('standard')} className={`flex items-center gap-2 px-8 py-2.5 rounded-xl text-sm font-black transition-all ${searchTab === 'standard' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Settings size={16} /> {translator("search.ai.tab.standardSearch")}
                    </button>
                </div>

                {/* 🎯 뷰 스위칭: 로직은 각 컴포넌트가 담당! */}
                {searchTab === 'ai' ? (
                    <AiSearchView
                        currentPage={currentPage}
                        searchMode={searchMode}
                        setSearchMode={setSearchMode}
                        query={query}
                        setQuery={setQuery}
                        options={options}
                        setOptions={setOptions}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        results={results}
                        setResults={setResults}
                        setTotalHits={setTotalHits}
                        setTargetKeyword={setTargetKeyword}
                        hasSearched={hasSearched}
                        setHasSearched={setHasSearched}
                        targetKeyword={targetKeyword}
                    />
                ) : (
                    <StandardSearchView
                        searchType={searchType}
                        setSearchType={setSearchType}
                        query={query} // 🎯 일반 검색도 검색어 관리가 필요함
                        setQuery={setQuery}
                        options={options}
                        setOptions={setOptions}
                        currentPage={currentPage}
                        setCurrentPage={setCurrentPage}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                        results={results}
                        setResults={setResults}
                        setTotalHits={setTotalHits}
                        setHasSearched={setHasSearched}
                        hasSearched={hasSearched}
                        setSearchMode={setSearchMode}
                        keywordCache={keywordCache} // 🎯 캐시 기능 추가
                        setKeywordCache={setKeywordCache} // 🎯 캐시 기능 추가
                        pageSize={pageSize}
                    />
                )}

                {/* 🎯 결과 리스트: 데이터가 있으면 누구든 여기를 통해 보여줌 */}
                {hasSearched && (
                    <ResultListSection
                        results={results}
                        totalHits={totalHits}
                        currentPage={currentPage}
                        onPageChange={setCurrentPage}
                        isLoading={isLoading}
                        pageSize={pageSize}
                        searchType={searchType}
                    />
                )}
            </main>
        </div>
    );
}
