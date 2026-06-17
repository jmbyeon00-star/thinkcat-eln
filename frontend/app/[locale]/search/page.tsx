'use client';

import React from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useSearchContext } from '@/contexts/SearchContext';
import { ResultListSection } from '@/components/search/ResultListSection';
import { StandardSearchView } from '@/components/search/StandardSearchView';
import { ShieldCheck } from 'lucide-react';
import PageShell from '@/components/layouts/PageShell';

export default function SearchPage() {
    const { data: session } = useSession();
    const isAdmin = (session as any)?.user?.role === 'admin';

    const {
        searchMode, setSearchMode,
        searchType, setSearchType,
        query, setQuery,
        results, setResults,
        totalHits, setTotalHits,
        options, setOptions,
        hasSearched, setHasSearched,
        currentPage, setCurrentPage,
        keywordCache, setKeywordCache,
        isLoading, setIsLoading,
        pageSize,
    } = useSearchContext();

    return (
        <PageShell
            title="특허검색"
            description="국내외 특허 데이터베이스를 통합 검색하여 기술 동향과 선행기술을 분석합니다."
        >
            {isAdmin && (
                <div className="fixed bottom-6 right-6 z-50">
                    <Link
                        href="/admin"
                        className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-2xl shadow-xl transition-all duration-200 hover:scale-105"
                    >
                        <ShieldCheck size={14} />
                        Admin 패널
                    </Link>
                </div>
            )}
            <div className={`flex flex-col items-center w-full transition-all duration-700 ${!hasSearched ? 'pt-10 pb-32' : 'pt-2 pb-40'}`}>
                <StandardSearchView
                    searchType={searchType}
                    setSearchType={setSearchType}
                    query={query}
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
                    totalHits={totalHits}
                    keywordCache={keywordCache}
                    setKeywordCache={setKeywordCache}
                    pageSize={pageSize}
                />

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
            </div>
        </PageShell>
    );
}
