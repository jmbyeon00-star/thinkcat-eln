import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { collectionanalysisByCode } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

// Pie 차트 색상
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF6B9D', '#C084FC', '#34D399'
];

const CollectionAnalysisDetail = () => {
  const router = useRouter();
  const { collectionCode } = router.query;
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!collectionCode) return;

    const fetchAnalysis = async () => {
      try {
        const data = await collectionanalysisByCode(collectionCode as string);
        setAnalysisData(data);
      } catch (err) {
        setError('분석 데이터를 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [collectionCode]);

  // 연도별 데이터를 Bar 차트용으로 변환
  const getYearChartData = () => {
    if (!analysisData?.date_result) return [];
    return Object.entries(analysisData.date_result)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, count]) => ({
        year: year + '년',
        count: count as number
      }));
  };

  // 출원인 데이터를 Pie 차트용으로 변환
  const getCompanyChartData = () => {
    if (!analysisData?.business_result) return [];
    return analysisData.business_result.map((company: any) => ({
      name: company.name || '이름 없음',
      value: company.count,
      code: company.applicant_code
    }));
  };

  // Pie Chart 클릭 핸들러
  const handlePieClick = (data: any) => {
    const code = data.code;
    if (code) {
      router.push(`/search/company/${code}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">분석 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error}</p>
          <Link href="/collectionanalysis">
            <a className="text-blue-600 hover:underline">컬렉션 리스트로 돌아가기</a>
          </Link>
        </div>
      </div>
    );
  }

  const yearChartData = getYearChartData();
  const companyChartData = getCompanyChartData();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 뒤로가기 버튼 */}
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            뒤로가기
          </button>
        </div>

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            컬렉션 상세 분석
          </h1>
          <p className="text-gray-600 font-mono">
            {collectionCode}
          </p>
        </div>

        {analysisData && (
          <div className="space-y-6">
            {/* 연도별 출원 건수 - Bar Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">연도별 출원 건수</h2>
              {yearChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={yearChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="year"
                      tick={{ fill: '#6B7280' }}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280' }}
                      label={{ value: '출원 건수', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px'
                      }}
                      formatter={(value: any) => [`${value}건`, '출원 건수']}
                    />
                    <Legend />
                    <Bar
                      dataKey="count"
                      fill="#3B82F6"
                      name="출원 건수"
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-8">연도별 데이터가 없습니다.</p>
              )}
            </div>

            {/* 상위 출원인 - Pie Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-6">상위 출원인 (Top 10)</h2>
              {companyChartData.length > 0 ? (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={500}>
                    <PieChart>
                      <Pie
                        data={companyChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry: any) => {
                          const percent = entry.percent || 0;
                          const name = entry.name || '';
                          return `${name} ${(percent * 100).toFixed(0)}%`;
                        }}
                        outerRadius={150}
                        fill="#8884d8"
                        dataKey="value"
                        onClick={handlePieClick}
                        style={{ cursor: 'pointer' }}
                      >
                        {companyChartData.map((_entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                            style={{ cursor: 'pointer' }}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #E5E7EB',
                          borderRadius: '8px'
                        }}
                        formatter={(value: any, name: any) => [`${value}건`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">출원인 데이터가 없습니다.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionAnalysisDetail;