import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { getCollectionList } from '@/lib/api';
import UmapVisualization from '@/components/patent/UmapVisualization';

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

interface Collection {
  index: number;
  collection_code: string;
  collection_name: string;
}

const CollectionAnalysis = () => {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 선택된 컬렉션들
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  // UMAP 분석 화면 표시 여부
  const [showAnalysis, setShowAnalysis] = useState(false);

  // 컬렉션 리스트 가져오기
  useEffect(() => {
    const fetchCollections = async () => {
      try {
        const data = await getCollectionList();
        setCollections(data);
      } catch (err) {
        setError('컬렉션 리스트를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCollections();
  }, []);

  // 검색 필터링
  const filteredCollections = collections.filter(
    (collection) =>
      collection.collection_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.collection_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 체크박스 토글
  const handleCheckboxChange = (collectionCode: string) => {
    setSelectedCollections(prev => {
      if (prev.includes(collectionCode)) {
        return prev.filter(code => code !== collectionCode);
      } else {
        return [...prev, collectionCode];
      }
    });
  };

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (selectedCollections.length === filteredCollections.length) {
      setSelectedCollections([]);
    } else {
      setSelectedCollections(filteredCollections.map(c => c.collection_code));
    }
  };

  // 카드 클릭 핸들러 (개별 상세 페이지로 이동)
  const handleCardClick = (collectionCode: string, event: React.MouseEvent) => {
    // 체크박스 클릭 시에는 페이지 이동하지 않음
    if ((event.target as HTMLElement).closest('.checkbox-container')) {
      return;
    }
    router.push(`/collectionanalysis/${collectionCode}`);
  };

  // UMAP 분석 실행
  const handleAnalyze = () => {
    if (selectedCollections.length === 0) return;
    setShowAnalysis(true);
  };

  // 분석 닫기
  const handleCloseAnalysis = () => {
    setShowAnalysis(false);
    setSelectedCollections([]);
  };

  // 컬렉션 코드 -> 이름 매핑
  const collectionNameMap = collections.reduce((acc, col) => {
    acc[col.collection_code] = col.collection_name;
    return acc;
  }, {} as { [key: string]: string });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  // UMAP 분석 화면 표시
  if (showAnalysis) {
    return (
      <UmapVisualization
        collectionCodes={selectedCollections}
        collectionNames={collectionNameMap}
        onClose={handleCloseAnalysis}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            콜렉션 분석
          </h1>
          <p className="text-gray-600">
            분석할 컬렉션을 선택하세요
          </p>
        </div>

        {/* 통계 및 분석 버튼 */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <p className="text-gray-600">
                전체 <span className="font-bold text-blue-600">{collections.length}</span>개 컬렉션
              </p>
              {searchTerm && (
                <p className="text-gray-600">
                  검색 결과 <span className="font-bold text-blue-600">{filteredCollections.length}</span>개
                </p>
              )}
              {selectedCollections.length > 0 && (
                <p className="text-gray-600">
                  선택됨 <span className="font-bold text-green-600">{selectedCollections.length}</span>개
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              {filteredCollections.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  {selectedCollections.length === filteredCollections.length ? '전체 해제' : '전체 선택'}
                </button>
              )}

              {selectedCollections.length > 0 && (
                <button
                  onClick={handleAnalyze}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  클러스터 분석
                </button>
              )}
            </div>
          </div>
        </div>


        {/* 컬렉션 카드 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCollections.map((collection) => (
            <div
              key={collection.collection_code}
              onClick={(e) => handleCardClick(collection.collection_code, e)}
              className={`bg-white rounded-lg shadow hover:shadow-lg transition-all cursor-pointer border-2 p-6 ${selectedCollections.includes(collection.collection_code)
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-blue-300'
                }`}
            >
              {/* 체크박스와 인덱스 */}
              <div className="flex items-start justify-between mb-3">
                <div
                  className="checkbox-container flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(collection.collection_code)}
                    onChange={() => handleCheckboxChange(collection.collection_code)}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-600 text-sm font-bold">
                  {collection.index}
                </span>
              </div>

              {/* 컬렉션 이름 */}
              <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-1">
                {collection.collection_name}
              </h3>

              {/* 컬렉션 코드 */}
              <p className="text-sm text-gray-500 font-mono mb-4 line-clamp-1">
                {collection.collection_code}
              </p>

              {/* 상세 보기 버튼 */}
              <div className="flex items-center justify-end text-blue-600 text-sm font-medium">
                상세 보기
                <svg
                  className="w-4 h-4 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* 검색 결과 없음 */}
        {filteredCollections.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-gray-500 text-lg">검색 결과가 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionAnalysis;