"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import { 
  BarChart3, 
  CircleDashed, 
  CircleCheckBig, 
  PieChart as PieChartIcon,
  TrendingUp,
  Filter,
  Download,
  X,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

type InferenceResult = {
  source: string;
  predicted_target: string;
  score: number;
  ground_truth?: string;  // 실제 정답 (있는 경우)
  is_correct?: boolean;   // 예측이 맞는지 여부
};

type EvaluationMetrics = {
  accuracy: number;
  correct_count: number;
  total_count: number;
  error_count: number;
};

type InferenceDetail = {
  file_id: number;
  file_name: string;
  model_name: string;
  task_type: string;
  created_datetime: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  total_rows: number;
  used_collections: string[];
  summary: { positive: number; negative: number };
  results: InferenceResult[];
  evaluation?: EvaluationMetrics;  // 평가 지표 (정답이 있는 경우)
};

type ScoreRange = {
  label: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
  color: string;
};

export default function FileDetailPage() {
  const router = useRouter();
  const { file_id } = router.query;
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";

  const { data: session, status } = useSession() as {
    data: (Session & { access_token?: string }) | null;
    status: "loading" | "authenticated" | "unauthenticated";
  };
  const token = session?.access_token;

  const [data, setData] = useState<InferenceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(0);
  
  // 결과 테이블 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  
  // 컬렉션 분포 페이지네이션 상태
  const [collectionCurrentPage, setCollectionCurrentPage] = useState(1);
  const [collectionItemsPerPage, setCollectionItemsPerPage] = useState(10);

  // 모달 상태 (source 전체보기)
  const [selectedRow, setSelectedRow] = useState<InferenceResult | null>(null);

  useEffect(() => {
    if (!router.isReady || !file_id) return;

    const loadDetail = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/ai/history/${file_id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("불러오기 실패:", err);
        alert("결과를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [router.isReady, file_id]);

  // 정답 데이터가 있는지 확인
  const hasGroundTruth = useMemo(() => {
    return data?.results?.some(r => r.ground_truth !== undefined) ?? false;
  }, [data?.results]);

  // ✅ 통계 계산
  const statistics = useMemo(() => {
    if (!data?.results) return null;

    const results = data.results;
    
    // 컬렉션별 분포
    const collectionMap = new Map<string, number>();
    results.forEach((r) => {
      const collection = r.predicted_target;
      collectionMap.set(collection, (collectionMap.get(collection) || 0) + 1);
    });
    const collectionStats = Array.from(collectionMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / results.length) * 100,
      }))
      .sort((a, b) => b.count - a.count);

    // 유사도 점수 범위별 분포
    const scoreRanges: ScoreRange[] = [
      { label: "90% 이상", min: 0.9, max: 1.0, count: 0, percentage: 0, color: "bg-emerald-500" },
      { label: "80-90%", min: 0.8, max: 0.9, count: 0, percentage: 0, color: "bg-green-500" },
      { label: "70-80%", min: 0.7, max: 0.8, count: 0, percentage: 0, color: "bg-blue-500" },
      { label: "60-70%", min: 0.6, max: 0.7, count: 0, percentage: 0, color: "bg-yellow-500" },
      { label: "50-60%", min: 0.5, max: 0.6, count: 0, percentage: 0, color: "bg-orange-500" },
      { label: "50% 미만", min: 0, max: 0.5, count: 0, percentage: 0, color: "bg-red-500" },
    ];

    results.forEach((r) => {
      const score = r.score;
      for (const range of scoreRanges) {
        if (score >= range.min && score < range.max) {
          range.count++;
          break;
        }
        if (score === 1.0 && range.max === 1.0) {
          range.count++;
          break;
        }
      }
    });

    scoreRanges.forEach((range) => {
      range.percentage = (range.count / results.length) * 100;
    });

    // 평균/중앙값/표준편차
    const scores = results.map((r) => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const sortedScores = [...scores].sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)];
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    // 고신뢰도 (80% 이상) 개수
    const highConfidence = results.filter((r) => r.score >= 0.8).length;
    const mediumConfidence = results.filter((r) => r.score >= 0.6 && r.score < 0.8).length;
    const lowConfidence = results.filter((r) => r.score < 0.6).length;

    // 최고/최저 점수
    const maxScore = Math.max(...scores);
    const minScoreVal = Math.min(...scores);

    return {
      collectionStats,
      scoreRanges,
      avgScore,
      medianScore,
      stdDev,
      highConfidence,
      mediumConfidence,
      lowConfidence,
      maxScore,
      minScore: minScoreVal,
    };
  }, [data?.results]);

  // ✅ 컬렉션 분포 페이지네이션
  const paginatedCollectionStats = useMemo(() => {
    if (!statistics?.collectionStats) return [];
    const startIndex = (collectionCurrentPage - 1) * collectionItemsPerPage;
    const endIndex = startIndex + collectionItemsPerPage;
    return statistics.collectionStats.slice(startIndex, endIndex);
  }, [statistics?.collectionStats, collectionCurrentPage, collectionItemsPerPage]);

  const collectionTotalPages = Math.ceil((statistics?.collectionStats.length || 0) / collectionItemsPerPage);

  // ✅ 필터링된 결과
  const filteredResults = useMemo(() => {
    if (!data?.results) return [];
    
    return data.results.filter((r) => {
      const matchCollection = selectedCollection === "all" || r.predicted_target === selectedCollection;
      const matchScore = r.score >= minScore / 100;
      return matchCollection && matchScore;
    });
  }, [data?.results, selectedCollection, minScore]);

  // ✅ 페이지네이션 계산
  const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
  const paginatedResults = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredResults.slice(startIndex, endIndex);
  }, [filteredResults, currentPage, itemsPerPage]);

  // 필터 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCollection, minScore, itemsPerPage]);

  // 컬렉션 페이지네이션 설정 변경 시 페이지를 1로 리셋
  useEffect(() => {
    setCollectionCurrentPage(1);
  }, [collectionItemsPerPage]);

  // ✅ CSV 다운로드
  const downloadCSV = () => {
    if (!data?.results) return;

    const headers = hasGroundTruth 
      ? ["입력 데이터", "예측 결과", "신뢰도 점수", "실제 정답", "정답 여부"]
      : ["입력 데이터", "예측 결과", "신뢰도 점수"];
    
    const rows = data.results.map((r) => {
      const baseRow = [
        `"${r.source.replace(/"/g, '""')}"`,
        `"${r.predicted_target.replace(/"/g, '""')}"`,
        (r.score * 100).toFixed(2),
      ];
      
      if (hasGroundTruth) {
        baseRow.push(
          `"${(r.ground_truth || '').replace(/"/g, '""')}"`,
          r.is_correct ? "O" : "X"
        );
      }
      
      return baseRow;
    });

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${data.file_name}_결과.csv`;
    link.click();
  };

  if (loading)
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
        <span className="ml-2 text-sm text-zinc-500">불러오는 중...</span>
      </div>
    );

  if (!data)
    return <p className="text-center mt-10 text-zinc-500">데이터가 없습니다.</p>;

  return (
    <>
      <Head>
        <title>{data.file_name} | 추론 결과</title>
      </Head>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-8">
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-800">{data.file_name}</h1>
            <p className="text-zinc-500 text-sm mt-1">
              {data.model_name} · {new Date(data.created_datetime).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={downloadCSV}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Download className="h-4 w-4" />
              CSV 다운로드
            </button>
            {data.status === "RUNNING" ? (
              <CircleDashed className="h-8 w-8 text-blue-500 animate-spin" />
            ) : data.status === "FAILED" ? (
              <span className="text-red-600 font-semibold">실패</span>
            ) : (
              <CircleCheckBig className="h-8 w-8 text-green-600" />
            )}
          </div>
        </div>

        {/* 평가 지표 카드 (정답이 있는 경우) */}
        {data.evaluation && (
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl border-2 border-purple-200 shadow-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="h-6 w-6 text-purple-600" />
              <h2 className="text-xl font-bold text-purple-900">평가 결과</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 border border-purple-100">
                <p className="text-xs text-purple-600 font-medium uppercase mb-1">정확도</p>
                <p className="text-3xl font-bold text-purple-900">
                  {data.evaluation.accuracy.toFixed(2)}%
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-green-100">
                <p className="text-xs text-green-600 font-medium uppercase mb-1">정답 개수</p>
                <p className="text-3xl font-bold text-green-900">
                  {data.evaluation.correct_count}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-red-100">
                <p className="text-xs text-red-600 font-medium uppercase mb-1">오답 개수</p>
                <p className="text-3xl font-bold text-red-900">
                  {data.evaluation.error_count}
                </p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-zinc-100">
                <p className="text-xs text-zinc-600 font-medium uppercase mb-1">전체 개수</p>
                <p className="text-3xl font-bold text-zinc-900">
                  {data.evaluation.total_count}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 기본 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200">
            <p className="text-xs text-blue-600 font-medium uppercase">총 데이터</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {data.total_rows.toLocaleString()}건
            </p>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-green-50 to-green-100 border border-green-200">
            <p className="text-xs text-green-600 font-medium uppercase">고신뢰도 (≥80%)</p>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {statistics?.highConfidence ?? 0}
              <span className="text-sm font-normal text-green-600 ml-2">
                ({((statistics?.highConfidence ?? 0) / data.total_rows * 100).toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200">
            <p className="text-xs text-yellow-600 font-medium uppercase">중신뢰도 (60-80%)</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">
              {statistics?.mediumConfidence ?? 0}
              <span className="text-sm font-normal text-yellow-600 ml-2">
                ({((statistics?.mediumConfidence ?? 0) / data.total_rows * 100).toFixed(1)}%)
              </span>
            </p>
          </div>
          <div className="p-5 rounded-xl bg-gradient-to-br from-red-50 to-red-100 border border-red-200">
            <p className="text-xs text-red-600 font-medium uppercase">저신뢰도 (&lt;60%)</p>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {statistics?.lowConfidence ?? 0}
              <span className="text-sm font-normal text-red-600 ml-2">
                ({((statistics?.lowConfidence ?? 0) / data.total_rows * 100).toFixed(1)}%)
              </span>
            </p>
          </div>
        </div>

        {/* 유사도 점수 통계 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-white" />
              <h2 className="text-xl font-bold text-white">유사도 점수 분석</h2>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* 주요 지표 */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase font-medium">평균</p>
                <p className="text-xl font-bold text-zinc-800 mt-1">
                  {(statistics?.avgScore ?? 0 * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase font-medium">중앙값</p>
                <p className="text-xl font-bold text-zinc-800 mt-1">
                  {(statistics?.medianScore ?? 0 * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase font-medium">표준편차</p>
                <p className="text-xl font-bold text-zinc-800 mt-1">
                  {(statistics?.stdDev ?? 0 * 100).toFixed(2)}%
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase font-medium">최고</p>
                <p className="text-xl font-bold text-green-600 mt-1">
                  {(statistics?.maxScore ?? 0 * 100).toFixed(1)}%
                </p>
              </div>
              <div className="text-center p-4 bg-zinc-50 rounded-lg">
                <p className="text-xs text-zinc-500 uppercase font-medium">최저</p>
                <p className="text-xl font-bold text-red-600 mt-1">
                  {(statistics?.minScore ?? 0 * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* 점수 범위별 분포 차트 */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-700">점수 분포</h3>
              {statistics?.scoreRanges.map((range) => (
                <div key={range.label} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">{range.label}</span>
                    <span className="text-zinc-600">
                      {range.count}건 ({range.percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`${range.color} h-full rounded-full transition-all duration-500`}
                      style={{ width: `${range.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 컬렉션별 분포 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PieChartIcon className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">컬렉션별 분포</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white text-sm">
                  총 {statistics?.collectionStats.length ?? 0}개 컬렉션
                </span>
                <select
                  value={collectionItemsPerPage}
                  onChange={(e) => setCollectionItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="6">6개씩</option>
                  <option value="10">10개씩</option>
                  <option value="15">15개씩</option>
                  <option value="20">20개씩</option>
                  <option value="50">50개씩</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedCollectionStats.map((stat) => {
                const globalIndex = statistics?.collectionStats.findIndex(s => s.name === stat.name) ?? 0;
                return (
                  <div
                    key={stat.name}
                    className="p-4 border border-zinc-200 rounded-xl hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-zinc-800 truncate">{stat.name}</span>
                      <span className="text-sm text-zinc-500">#{globalIndex + 1}</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-2xl font-bold text-blue-600">{stat.count}</span>
                      <span className="text-sm text-zinc-600">
                        {stat.percentage.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-2 w-full bg-zinc-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 컬렉션 분포 페이지네이션 */}
            {collectionTotalPages > 1 && (
              <div className="mt-6 pt-6 border-t border-zinc-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-600">
                    {(collectionCurrentPage - 1) * collectionItemsPerPage + 1} - {Math.min(collectionCurrentPage * collectionItemsPerPage, statistics?.collectionStats.length ?? 0)} / {statistics?.collectionStats.length ?? 0}개
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCollectionCurrentPage(1)}
                      disabled={collectionCurrentPage === 1}
                      className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                    >
                      ««
                    </button>
                    <button
                      onClick={() => setCollectionCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={collectionCurrentPage === 1}
                      className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                    >
                      이전
                    </button>
                    
                    {/* 페이지 번호 버튼 */}
                    {Array.from({ length: Math.min(5, collectionTotalPages) }, (_, i) => {
                      let pageNum: number;
                      
                      if (collectionTotalPages <= 5) {
                        pageNum = i + 1;
                      } else if (collectionCurrentPage <= 3) {
                        pageNum = i + 1;
                      } else if (collectionCurrentPage >= collectionTotalPages - 2) {
                        pageNum = collectionTotalPages - 4 + i;
                      } else {
                        pageNum = collectionCurrentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCollectionCurrentPage(pageNum)}
                          className={`px-3 py-2 border-2 rounded-lg transition-all text-sm font-medium ${
                            collectionCurrentPage === pageNum
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "border-zinc-300 hover:bg-zinc-100"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => setCollectionCurrentPage((prev) => Math.min(collectionTotalPages, prev + 1))}
                      disabled={collectionCurrentPage === collectionTotalPages}
                      className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                    >
                      다음
                    </button>
                    <button
                      onClick={() => setCollectionCurrentPage(collectionTotalPages)}
                      disabled={collectionCurrentPage === collectionTotalPages}
                      className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                    >
                      »»
                    </button>
                  </div>

                  <div className="text-sm text-zinc-600">
                    페이지 {collectionCurrentPage} / {collectionTotalPages}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 필터 및 결과 테이블 */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-white" />
                <h2 className="text-xl font-bold text-white">추론 결과</h2>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white text-sm">
                  {filteredResults.length} / {data.results.length}건
                </span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="px-3 py-1 rounded-lg text-sm bg-white/20 text-white border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                >
                  <option value="10">10개씩</option>
                  <option value="20">20개씩</option>
                  <option value="50">50개씩</option>
                  <option value="100">100개씩</option>
                </select>
              </div>
            </div>
          </div>

          {/* 필터 컨트롤 */}
          <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-zinc-500" />
                <span className="text-sm font-medium text-zinc-700">필터:</span>
              </div>
              
              <select
                value={selectedCollection}
                onChange={(e) => setSelectedCollection(e.target.value)}
                className="px-3 py-2 border border-zinc-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">모든 컬렉션</option>
                {statistics?.collectionStats.map((stat) => (
                  <option key={stat.name} value={stat.name}>
                    {stat.name} ({stat.count})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-600">최소 유사도:</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={(e) => setMinScore(Number(e.target.value))}
                  className="w-32"
                />
                <span className="text-sm font-medium text-zinc-700 w-12">
                  {minScore}%
                </span>
              </div>

              {(selectedCollection !== "all" || minScore > 0) && (
                <button
                  onClick={() => {
                    setSelectedCollection("all");
                    setMinScore(0);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  필터 초기화
                </button>
              )}
            </div>
          </div>

          {/* 결과 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold">#</th>
                  <th className="px-6 py-3 text-left font-semibold">입력 데이터</th>
                  <th className="px-6 py-3 text-left font-semibold">예측 결과</th>
                  {hasGroundTruth && (
                    <th className="px-6 py-3 text-left font-semibold">실제 정답</th>
                  )}
                  <th className="px-6 py-3 text-right font-semibold">신뢰도 점수</th>
                  <th className="px-6 py-3 text-center font-semibold">신뢰도</th>
                  {hasGroundTruth && (
                    <th className="px-6 py-3 text-center font-semibold">정답 여부</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedResults.map((r, i) => {
                  const scorePercent = r.score * 100;
                  const confidenceLevel = scorePercent >= 80 ? "high" : scorePercent >= 60 ? "medium" : "low";
                  const globalIndex = (currentPage - 1) * itemsPerPage + i + 1;
                  
                  return (
                    <tr 
                      key={i} 
                      className="border-b border-zinc-100 hover:bg-blue-50/40 transition-colors cursor-pointer"
                      onClick={() => setSelectedRow(r)}
                    >
                      <td className="px-6 py-3 text-zinc-500">{globalIndex}</td>
                      <td className="px-6 py-3 text-zinc-700 max-w-md truncate">
                        {r.source}
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {r.predicted_target}
                        </span>
                      </td>
                      {hasGroundTruth && (
                        <td className="px-6 py-3">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-700">
                            {r.ground_truth}
                          </span>
                        </td>
                      )}
                      <td className="px-6 py-3 text-right">
                        <span className={`font-semibold ${
                          confidenceLevel === "high" ? "text-green-600" :
                          confidenceLevel === "medium" ? "text-yellow-600" :
                          "text-red-600"
                        }`}>
                          {scorePercent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          confidenceLevel === "high" 
                            ? "bg-green-100 text-green-700" 
                            : confidenceLevel === "medium"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {confidenceLevel === "high" ? "높음" : confidenceLevel === "medium" ? "중간" : "낮음"}
                        </span>
                      </td>
                      {hasGroundTruth && (
                        <td className="px-6 py-3 text-center">
                          {r.is_correct ? (
                            <CheckCircle className="h-5 w-5 text-green-600 inline-block" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 inline-block" />
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredResults.length === 0 && (
            <div className="py-12 text-center text-zinc-500">
              필터 조건에 맞는 결과가 없습니다.
            </div>
          )}

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-zinc-600">
                  {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredResults.length)} / {filteredResults.length}건
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                  >
                    ««
                  </button>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                  >
                    이전
                  </button>
                  
                  {/* 페이지 번호 버튼 */}
                  {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                    let pageNum: number;
                    
                    if (totalPages <= 7) {
                      pageNum = i + 1;
                    } else if (currentPage <= 4) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      pageNum = totalPages - 6 + i;
                    } else {
                      pageNum = currentPage - 3 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-2 border-2 rounded-lg transition-all text-sm font-medium ${
                          currentPage === pageNum
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-zinc-300 hover:bg-zinc-100"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                  >
                    다음
                  </button>
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 border-2 border-zinc-300 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-100 transition-all text-sm font-medium"
                  >
                    »»
                  </button>
                </div>

                <div className="text-sm text-zinc-600">
                  페이지 {currentPage} / {totalPages}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 상세보기 모달 */}
      {selectedRow && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRow(null)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">상세 정보</h3>
              <button
                onClick={() => setSelectedRow(null)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="text-sm font-semibold text-zinc-600 uppercase mb-2 block">
                  입력 데이터
                </label>
                <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                  <p className="text-zinc-800 whitespace-pre-wrap break-words">
                    {selectedRow.source}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-600 uppercase mb-2 block">
                    예측 결과
                  </label>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-900 font-medium">
                      {selectedRow.predicted_target}
                    </p>
                  </div>
                </div>

                {hasGroundTruth && (
                  <div>
                    <label className="text-sm font-semibold text-zinc-600 uppercase mb-2 block">
                      실제 정답
                    </label>
                    <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                      <p className="text-zinc-900 font-medium">
                        {selectedRow.ground_truth}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-semibold text-zinc-600 uppercase mb-2 block">
                    신뢰도 점수
                  </label>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-2xl font-bold text-green-900">
                      {(selectedRow.score * 100).toFixed(2)}%
                    </p>
                  </div>
                </div>

                {hasGroundTruth && (
                  <div>
                    <label className="text-sm font-semibold text-zinc-600 uppercase mb-2 block">
                      정답 여부
                    </label>
                    <div className={`p-4 rounded-lg border-2 ${
                      selectedRow.is_correct 
                        ? "bg-green-50 border-green-300"
                        : "bg-red-50 border-red-300"
                    }`}>
                      <div className="flex items-center gap-2">
                        {selectedRow.is_correct ? (
                          <>
                            <CheckCircle className="h-6 w-6 text-green-600" />
                            <p className="text-xl font-bold text-green-900">정답</p>
                          </>
                        ) : (
                          <>
                            <XCircle className="h-6 w-6 text-red-600" />
                            <p className="text-xl font-bold text-red-900">오답</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}