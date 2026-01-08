import { useRouter } from "next/router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ArrowRight, BarChart3, FileText, XCircle, Loader2, PieChart as PieChartIcon, BarChart2, ChevronLeft, ChevronRight, Plus, Save, Search, Eye, List } from "lucide-react";

import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import AddCollectionModal from "@/components/collection/AddCollectionModal";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { CollectionInfo } from "@/types/collection";

import { withMessages } from '@/lib/i18n/withMessages';
import { ProjectInfo } from "@/types/project";
export const getServerSideProps = withMessages();

// 새 차트 데이터 타입 정의 (막대 그래프와 파이 그래프 공통 사용)
type ChartData = {
    name: string;
    value: number;
    ratio: number;
    color: string;
};

function CollectionSettingPageContent() {
    const router = useRouter();
    const { project_id } = router.query;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const { data: session, status: sessionStatus } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [viewMode, setViewMode] = useState<'list' | 'stats'>('list');
    const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [collectionInfo, setCollectionInfo] = useState<CollectionInfo[] | []>([]);
    const [loading, setLoading] = useState(true);

    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(10);
    const [total, setTotal] = useState(0);
    const [totalDataNum, setTotalDataNum] = useState(0);

    console.log("collectionInfo:", collectionInfo)

    // --- Data Loading Logic (실제 Fetch 사용) ---
    const loadCollections = useCallback(async () => {
        if (!project_id || !token || !API_BASE) {
            setLoading(false);
            return;
        }

        try {
            setLoading(true);

            // --- ACTUAL FETCH LOGIC ---
            const res = await fetch(`${API_BASE}/api/project/${project_id}/collection?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "API Load Failed");
            }

            const data = await res.json();

            setProjectInfo(data.project_info || [])
            setCollectionInfo(data.collection_info || []);
            setTotal(data.total_collections || 0);
            setTotalDataNum(data.total_data_num || 0);

        } catch (e) {
            console.error("컬렉션 목록을 불러오지 못했습니다:", e);
            setCollectionInfo([]);
            setTotal(0);
            setTotalDataNum(0);
        } finally {
            setLoading(false);
        }
    }, [token, project_id, page, limit, query, API_BASE]);
    console.log("projectInfo:", projectInfo)
    // Initial load and dependency tracking
    useEffect(() => {
        const debounce = setTimeout(loadCollections, 300);
        return () => clearTimeout(debounce);
    }, [loadCollections]);

    // --- Collection Add Logic (실제 Fetch 사용) ---
    const handleAddCollection = async (collectionName: string) => {
        if (!token || !API_BASE) {
            alert('인증 정보 또는 API 경로가 유효하지 않습니다.');
            return Promise.reject(new Error("Missing credentials/API Base."));
        }

        try {
            setLoading(true);

            // --- ACTUAL FETCH LOGIC (POST) ---
            const res = await fetch(`${API_BASE}/api/project/${project_id}/collection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ collection_name: collectionName }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || "컬렉션 추가에 실패했습니다.");
            }

            alert(`컬렉션 '${collectionName}'이 성공적으로 추가되었습니다.`);

            // 데이터 새로고침을 위해 쿼리/페이지 리셋 (loadCollections가 다시 실행됨)
            setQuery("");
            setPage(1);
            setIsAddModalOpen(false);
            return Promise.resolve();

        } catch (error) {
            console.error("컬렉션 추가 에러:", error);
            alert(`컬렉션 추가 에러: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
            return Promise.reject(error);
        } finally {
            setLoading(false);
        }
    };

    // 파이 차트 색상 정의
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF19A6', '#19FFD1', '#5B86E5', '#A52A2A', '#004D40'];
    const RADIAN = Math.PI / 180;

    // 파이 차트의 라벨 렌더링 함수
    const renderCustomizedLabel = (props: any): JSX.Element | null => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;

        if (!cx || !cy || !innerRadius || !outerRadius || !percent) return null;
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        return (
            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" style={{ fontSize: '10px' }}>
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        );
    };

    // 데이터를 useMemo로 차트용 데이터로 변환 (BarChart, PieChart 공통)
    const chartData: ChartData[] = useMemo(() => {
        if (!Array.isArray(collectionInfo) || totalDataNum === 0) return [];
        // 컬렉션 배열을 데이터 수 기준으로 내림차순 정렬하여 상위 10개 추출
        const sortedCollections = [...collectionInfo]
            .sort((a, b) => b.collection_data_num - a.collection_data_num)
            .slice(0, 10); // 상위 10개만 차트에 표시

        return sortedCollections.map((col, index) => ({
            name: col.collection_name,
            value: col.collection_data_num,
            // 백엔드에서 비율을 계산하여 넘겨주지 않는 경우, 클라이언트에서 계산 (데이터 정확도 문제 발생 가능성 있음)
            ratio: col.calculated_ratio ?? (col.collection_data_num / totalDataNum) * 100,
            color: COLORS[index % COLORS.length]
        }));
    }, [collectionInfo, totalDataNum]);

    // Handle pagination change
    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= Math.ceil(total / limit)) {
            setPage(newPage);
        }
    };

    const handleCollectionNumCheck = () => {
        console.log("?")
    }

    const renderBarChart = () => (
        <ResponsiveContainer width="100%" height={400}>
            <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                layout="vertical" // 수직 막대 그래프를 기본으로 설정
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                    type="number"
                    dataKey="value"
                    tickFormatter={(value) => `${value.toLocaleString()}`}
                    label={{ value: '데이터 수 (건)', position: 'insideBottomRight', offset: 0, dy: 10, fill: '#666' }}
                    style={{ fontSize: '12px' }}
                />
                <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    style={{ fontSize: '12px' }}
                    axisLine={false}
                    tickLine={false}
                />
                <Tooltip
                    cursor={{ fill: '#f5f5f5' }}
                    formatter={(value, name, props) => {
                        const collectionName = props.payload.name;
                        const ratio = props.payload.ratio;
                        return [
                            `${(value as number).toLocaleString()}건 (${ratio.toFixed(2)}%)`,
                            collectionName,
                        ];
                    }}
                />
                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="value" name="데이터 수" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                        <Cell key={`bar-cell-${index}`} fill={entry.color} />
                    ))}
                </Bar>
            </BarChart>
        </ResponsiveContainer>
    );

    // 파이 그래프 렌더링 컴포넌트 (기존 코드 기반)
    const renderPieChart = () => (
        <ResponsiveContainer width="100%" height={400}>
            <PieChart>
                <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    fill="#8884d8"
                    labelLine={false}
                    label={renderCustomizedLabel}
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value, name, props) => {
                        const collectionName = props.payload.name;
                        const ratio = props.payload.ratio;
                        return [
                            `${(value as number).toLocaleString()}건 (${ratio.toFixed(2)}%)`,
                            collectionName // 컬렉션 이름이 툴팁 제목처럼 표시됩니다.
                        ];
                    }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ paddingTop: '20px' }} />
            </PieChart>
        </ResponsiveContainer>
    );

    const renderCollectionList = () => (
        <div className="bg-white border border-zinc-200 p-6 rounded-xl shadow-lg">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold flex items-center gap-2 text-zinc-800">
                    <List className="w-5 h-5 text-blue-600" /> 컬렉션 목록 ({total}개)
                </h2>
                <div className="flex gap-3">
                    {/* 통계 보기 버튼 */}
                    <button
                        onClick={() => { setViewMode('stats'); setChartType('bar'); }} // 통계 뷰로 이동 시 기본 차트 유형은 막대 그래프
                        className="flex items-center gap-2 px-4 py-2 border border-zinc-300 rounded-lg text-zinc-700 hover:bg-zinc-100 transition shadow-md whitespace-nowrap"
                    >
                        <Eye className="w-5 h-5" /> 통계 보기
                    </button>
                    {/* 새 컬렉션 추가 버튼 */}
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 shadow-md whitespace-nowrap"
                    >
                        <Plus className="w-5 h-5" /> 새 컬렉션 추가
                    </button>
                </div>
            </div>

            {/* 검색 입력 필드 */}
            <div className="mb-4 relative">
                <input
                    type="text"
                    placeholder="컬렉션 이름 또는 ID로 검색"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setPage(1); // Reset to page 1 on new search query
                    }}
                    className="w-full md:w-1/3 pl-10 p-2 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400" />
            </div>

            {/* 컬렉션 목록 테이블 */}
            <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="min-w-full divide-y divide-zinc-200">
                    <thead>
                        <tr className="bg-zinc-100">
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-600 uppercase tracking-wider rounded-tl-lg">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-zinc-600 uppercase tracking-wider">컬렉션 이름</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-600 uppercase tracking-wider">데이터 수 (건)</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-zinc-600 uppercase tracking-wider rounded-tr-lg">비율 (%)</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-zinc-200">
                        {Array.isArray(collectionInfo) && collectionInfo.map((col) => (
                            <tr key={col.id} className="hover:bg-blue-50/50 transition duration-100">
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-zinc-900">{col.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700">{col.collection_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-zinc-700 text-right">{col.collection_data_num?.toLocaleString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-blue-600 text-right">
                                    {(col.calculated_ratio ?? col.collection_data_ratio)?.toFixed(2)}%
                                </td>
                            </tr>
                        ))}
                        {Array.isArray(collectionInfo) && collectionInfo.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-zinc-500 bg-zinc-50">
                                    검색 결과가 없거나 컬렉션이 없습니다.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* 페이지네이션 */}
            <div className="flex justify-between items-center mt-6">
                <p className="text-sm text-zinc-600">총 {total}개의 컬렉션 중 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 표시</p>
                <div className="flex gap-2 items-center">
                    <button
                        onClick={() => handlePageChange(page - 1)}
                        disabled={page === 1}
                        className="p-2 border border-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-100 transition"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg">{page}/{Math.ceil(total / limit)}</span>
                    <button
                        onClick={() => handlePageChange(page + 1)}
                        disabled={page * limit >= total}
                        className="p-2 border border-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-100 transition"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    const renderStatsView = () => (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                {/* 차트 전환 버튼 */}
                <div className="flex gap-2 p-1 border border-zinc-300 rounded-lg bg-zinc-50">
                    <button
                        onClick={() => setChartType('bar')}
                        className={`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md transition ${chartType === 'bar' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-700 hover:bg-zinc-200'
                            }`}
                    >
                        <BarChart2 className="w-4 h-4" /> 막대 그래프
                    </button>
                    <button
                        onClick={() => setChartType('pie')}
                        className={`flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-md transition ${chartType === 'pie' ? 'bg-blue-600 text-white shadow-md' : 'text-zinc-700 hover:bg-zinc-200'
                            }`}
                    >
                        <PieChartIcon className="w-4 h-4" /> 파이 그래프
                    </button>
                </div>
                {/* 목록 보기 버튼 */}
                <button
                    onClick={() => setViewMode('list')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-150 shadow-md whitespace-nowrap"
                >
                    <List className="w-5 h-5" /> 목록으로 돌아가기
                </button>
            </div>

            {/* 통계 요약 카드 섹션 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 총 컬렉션 수 카드 (사용자가 필터링한 총 개수) */}
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-blue-600">컬렉션 수</p>
                        <p className="text-3xl font-bold text-zinc-900">{total}개</p>
                    </div>
                    <BarChart3 className="w-10 h-10 text-blue-400 opacity-50" />
                </div>

                {/* 전체 데이터 수 카드 (API에서 가져온 총 데이터 수) */}
                <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-indigo-600">총 데이터 수</p>
                        <p className="text-3xl font-bold text-zinc-900">{totalDataNum.toLocaleString()}건</p>
                    </div>
                    <FileText className="w-10 h-10 text-indigo-400 opacity-50" />
                </div>

                {/* 프로젝트 ID 카드 */}
                <div className="bg-green-50 border-l-4 border-green-600 p-4 rounded-lg shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-green-600">프로젝트 ID</p>
                        <p className="text-lg font-bold text-zinc-900 break-all">{project_id}</p>
                    </div>
                    <span className="text-3xl text-green-400 opacity-50">#</span>
                </div>

                {/* 차트 영역 */}
                <div className="lg:col-span-3 bg-white border border-zinc-200 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-zinc-800">
                        {chartType === 'bar' ? (
                            <BarChart2 className="w-5 h-5 text-blue-600" />
                        ) : (
                            <PieChartIcon className="w-5 h-5 text-blue-600" />
                        )}
                        컬렉션 데이터 비율 (Top {chartData.length}개 표시)
                    </h2>
                    {totalDataNum > 0 ? (
                        <>
                            {chartType === 'bar' ? renderBarChart() : renderPieChart()}
                        </>
                    ) : (
                        <div className="text-center py-10 text-zinc-500">
                            표시할 데이터가 없습니다.
                        </div>
                    )}

                    {/* 페이지네이션은 차트 뷰에서는 필요 없지만, 목록에서 가져온 데이터임을 명시하기 위해 유지 */}
                    <div className="flex justify-between items-center mt-6">
                        <p className="text-sm text-zinc-600">총 {total}개의 컬렉션 중 {(page - 1) * limit + 1} - {Math.min(page * limit, total)} 표시</p>
                        {/* 페이지네이션 버튼... (목록 뷰와 동일) */}
                        <div className="flex gap-2 items-center">
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1}
                                className="p-2 border border-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-100 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-4 py-2 text-sm font-medium text-zinc-700 bg-zinc-100 rounded-lg">{page}/{Math.ceil(total / limit)}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page * limit >= total}
                                className="p-2 border border-zinc-300 rounded-lg disabled:opacity-50 hover:bg-zinc-100 transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (loading) {
        return (
            <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
                <div className="flex min-h-screen items-center justify-center bg-white">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-zinc-600">통계 불러오는 중...</span>
                    </div>
                </div>
            </ProjectLayout>
        );
    }

    if (!collectionInfo) {
        return (
            <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
                <div className="min-h-screen bg-white p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <p className="text-red-700 font-semibold">통계를 불러오지 못했습니다.</p>
                        </div>
                    </div>
                </div>
            </ProjectLayout>
        );
    }

    // collections가 빈 배열이 아니라 null/undefined일 경우 에러 처리
    if (!Array.isArray(collectionInfo) && !loading) {
        return (
            <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
                <div className="min-h-screen bg-white p-8">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                            <p className="text-red-700 font-semibold">통계를 불러오지 못했습니다.</p>
                        </div>
                    </div>
                </div>
            </ProjectLayout>
        );
    }

    return (
        <ProjectLayout projectNo={project_id as string} token={token} API_BASE={API_BASE}>
            <div className="space-y-8">
                {/* 1. 제목 섹션 */}
                <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-1 h-8 bg-gradient-to-b from-blue-700 to-blue-900 rounded-full" />
                            <h1 className="text-3xl font-bold text-zinc-900">
                                {viewMode === 'list' ? '컬렉션 관리 및 목록' : '컬렉션 통계 대시보드'}
                            </h1>
                        </div>
                    </div>
                    <p className="text-zinc-600 ml-4">
                        {viewMode === 'list'
                            ? '새 컬렉션을 생성하고 기존 목록을 관리합니다.'
                            : '프로젝트 데이터의 컬렉션별 비율 및 통계를 확인합니다.'}
                    </p>
                </div>

                {/* 본문 뷰 전환 */}
                {viewMode === 'list' ? renderCollectionList() : renderStatsView()}
            </div>

            {/* 4. 새 컬렉션 추가 모달 컴포넌트 */}
            {isAddModalOpen && (
                <AddCollectionModal
                    project_id={project_id as string}
                    onClose={() => setIsAddModalOpen(false)}
                    onSave={handleAddCollection as any}
                />
            )}

            <div className="flex gap-3 pt-5">
                <button
                    onClick={() => handleCollectionNumCheck()}
                    disabled={false}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center gap-2"
                >
                    <Save size={18} />
                    이전
                    {/* 저장하기 {Object.keys(modified).length > 0 && `(${Object.keys(modified).length})`} */}
                </button>
                <button
                    onClick={() => {
                        const project = Array.isArray(projectInfo) ? projectInfo[0] : projectInfo;

                        if (project) {
                            router.push(`/project/${project_id}/models/new?collection_num=${collectionInfo.length}&task_type=${projectInfo?.task_type}&source_type=${projectInfo?.source_type}`)
                        }
                    }}
                    // onClick={() => handleCollectionNumCheck()}
                    className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
                >
                    다음
                    <ArrowRight size={18} />
                </button>
            </div>
        </ProjectLayout>
    );
}

export default function App() {
    return <CollectionSettingPageContent />;
}