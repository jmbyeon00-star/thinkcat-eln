import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft } from "lucide-react";
import { useRouter } from 'next/router';
import { getUmapData } from '@/lib/api';
import UmapGraph from '@/components/patent/UmapGraph';
import { getCategoryColor } from '@/lib/colorMapping';

interface UmapPoint {
  UMAP1: number;
  UMAP2: number;
  category: string;
  label: string;
  application_number: string;
  collection_name: string;
  ipc_code: string;
}

interface UmapVisualizationProps {
  collectionCodes: string[];
  collectionNames?: { [key: string]: string };
  onClose?: () => void;
}

const UmapVisualization: React.FC<UmapVisualizationProps> = ({
  collectionCodes,
  collectionNames = {},
  onClose
}) => {
  const router = useRouter();
  const [umapData, setUmapData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionCodes || collectionCodes.length === 0) return;

    const fetchUmapData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await getUmapData(
          collectionCodes.length === 1 ? collectionCodes[0] : collectionCodes
        );

        // 개발 환경에서만 로그
        if (process.env.NODE_ENV === 'development') {
          console.log('UMAP 데이터:', data);
        }

        setUmapData(data);
      } catch (err: any) {
        console.error('UMAP 데이터 로드 실패:', err);
        const errorMessage = err?.response?.data?.detail || err?.message || 'UMAP 데이터를 불러오는데 실패했습니다.';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchUmapData();
  }, [collectionCodes]);

  // UMAP 차트 데이터 추출 (메모이제이션)
  const umapChartData = useMemo(() => {
    if (!umapData || !Array.isArray(umapData) || umapData.length < 2) {
      return [];
    }

    const umapPoints = umapData[1];

    if (!Array.isArray(umapPoints)) {
      return [];
    }

    return umapPoints;
  }, [umapData]);

  // 통계 계산 (메모이제이션)
  const statistics = useMemo(() => {
    if (umapChartData.length === 0) return null;

    const umap1Values = umapChartData.map(d => d.UMAP1);
    const umap2Values = umapChartData.map(d => d.UMAP2);
    const categories = new Set(umapChartData.map(d => d.category));

    // 카테고리별 개수 계산
    const categoryCounts: { [key: string]: number } = {};
    umapChartData.forEach(d => {
      const cat = d.category;
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    return {
      totalCount: umapChartData.length,
      categoryCount: categories.size,
      categoryCounts: categoryCounts,
      umap1Range: {
        min: Math.min(...umap1Values),
        max: Math.max(...umap1Values)
      },
      umap2Range: {
        min: Math.min(...umap2Values),
        max: Math.max(...umap2Values)
      }
    };
  }, [umapChartData]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-blue-600 mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>뒤로가기</span>
        </button>

        {/* 헤더 */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-1.5 h-8 bg-blue-700 rounded-full" />
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                벡터 클러스터 분석
              </h1>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
              >
                닫기
              </button>
            )}
          </div>
          <p className="text-gray-600">
            {collectionCodes.length === 1
              ? '단일 컬렉션의 CPC 코드별 특허 분포'
              : `${collectionCodes.length}개 컬렉션의 비교 분석`}
          </p>
        </div>

        {/* 통계 정보 */}
        {!loading && statistics && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* 총 특허 수 */}
              <div className="text-center px-6">
                <p className="text-sm text-gray-600 mb-1">총 특허 수</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.totalCount.toLocaleString()}
                </p>
              </div>

              {/* 구분선 */}
              <div className="hidden md:block w-px h-12 bg-gray-300"></div>

              {/* 카테고리 수 */}
              <div className="text-center px-6">
                <p className="text-sm text-gray-600 mb-1">카테고리 수</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statistics.categoryCount}
                </p>
              </div>

              {/* 구분선 */}
              <div className="hidden md:block w-px h-12 bg-gray-300"></div>

              {/* 카테고리별 분포 */}
              <div className="px-6">
                <p className="text-sm text-gray-600 mb-3 text-center">카테고리별 분포</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {Object.entries(statistics.categoryCounts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => {
                      // 공통 색상 로직 사용
                      const allCategories = Object.keys(statistics.categoryCounts);
                      const color = getCategoryColor(category, allCategories);

                      return (
                        <div
                          key={category}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium text-gray-700">
                            {category}
                          </span>
                          <span className="text-sm font-bold text-gray-900">
                            {count.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 오류 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-red-800 font-medium">오류 발생</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* UMAP 그래프 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold mb-2">
              {collectionCodes.length === 1
                ? '특허 벡터 분포 - CPC 코드 분류'
                : '컬렉션별 특허 벡터 분포'}
            </h2>
            <p className="text-sm text-gray-600">
              각 점은 하나의 특허를 나타내며,
              {collectionCodes.length === 1
                ? ' CPC 섹션별로 색상이 구분됩니다.'
                : ' 컬렉션별로 색상이 구분됩니다.'}
            </p>
          </div>

          <UmapGraph
            data={umapChartData}
            loading={loading}
            height={700}
          />
        </div>
      </div>
    </div>
  );
};

export default UmapVisualization;