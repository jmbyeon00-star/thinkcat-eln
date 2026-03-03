"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import {
    ScatterChart,
    Scatter,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ZAxis,
    ReferenceLine,
} from "recharts";
import {
    Building2,
    ShieldAlert,
    Users,
    History,
    LayoutDashboard,
    CheckCircle2,
    AlertCircle,
    Target
} from "lucide-react";
import { applicantByNavigate } from "@/lib/api";

// ------------------------------------
// 1. 타입 정의
// ------------------------------------
type ApplicantData = {
    applicant_code: string;
    applicant_name_rep: string;
    min_distance: number;
    max_filing_year: number;
    application_count: number;
};

type NavigationData = {
    applicant_code: string;
    applicant_name_rep: string;
    filing_date?: string;
    x_value: number;
    y_value: number;
    score: number;
    isMyPatent?: boolean;
};

type PatNavigationProps = {
    applicationNumber: string;
    code: string;
    myPatentFilingDate?: string;
};

// ------------------------------------
// 2. CustomTooltip 컴포넌트 (다크 테마)
// ------------------------------------
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isMyPatent = data.isMyPatent;

        const formatDate = (dateString?: string) => {
            if (!dateString) return null;
            if (dateString.includes('-') || dateString.length >= 8) {
                return dateString.substring(0, 4);
            }
            return dateString;
        };

        let classificationText;
        if (isMyPatent) {
            classificationText = "나의 기준 기업";
        } else if (data.color === "#ef4444") {
            classificationText = "Score 최저 2건 (위험)";
        } else {
            classificationText = "기타 기업";
        }

        return (
            <div className="bg-slate-900/95 backdrop-blur-md px-5 py-4 rounded-[1.5rem] shadow-2xl border border-white/10 ring-1 ring-black/5">
                <p className="text-sm font-bold text-indigo-400 mb-3">
                    {isMyPatent ? "기준 기업 정보" : "기업 정보"}
                </p>

                <div className="space-y-2.5">
                    {data.applicant_name_rep && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-slate-500 font-medium">기업명</span>
                            <span className="text-sm font-semibold text-white">{data.applicant_name_rep}</span>
                        </div>
                    )}

                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-slate-500 font-medium">출원인 코드</span>
                        <span className="text-sm font-semibold text-white">{data.applicant_code}</span>
                    </div>

                    {data.filing_date && (
                        <div className="flex flex-col gap-0.5">
                            <span className="text-xs text-slate-500 font-medium">출원연도</span>
                            <span className="text-sm font-semibold text-white">{formatDate(data.filing_date)}</span>
                        </div>
                    )}

                    <div className="pt-2.5 flex items-center gap-2 border-t border-white/10">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                        <span className="text-xs font-medium text-slate-300">
                            {classificationText}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

// ------------------------------------
// 3. 메인 컴포넌트
// ------------------------------------
export default function PatNavigationChart({
    applicationNumber,
    code,
    myPatentFilingDate
}: PatNavigationProps) {
    const router = useRouter();
    const [plotData, setPlotData] = useState<NavigationData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleClick = (applicantCode: string, isMyPatent: boolean) => {
        if (applicantCode && !isMyPatent) {
            router.push(`/company/${applicantCode}`);
        }
    };

    useEffect(() => {
        if (!applicationNumber || !code) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);
                setError(null);

                const apiResult = await applicantByNavigate(applicationNumber, code) as any;

                if (!apiResult || !Array.isArray(apiResult.data)) {
                    throw new Error("응답 형식이 올바르지 않습니다.");
                }

                const rawData: ApplicantData[] = apiResult.data;

                // min_distance가 0인 항목 찾기 (나의 특허)
                const myPatentItem = rawData.find(item => item.min_distance === 0);

                // 나의 특허 연도 결정
                const myPatentYear = myPatentItem?.max_filing_year ||
                    (myPatentFilingDate ? parseInt(myPatentFilingDate.substring(0, 4), 10) : new Date().getFullYear());

                // 비교 특허들의 연도 수집
                const comparisonData = rawData.filter(item => item.min_distance !== 0);
                const comparisonYears = comparisonData.map(d => d.max_filing_year).filter(year => year !== undefined);

                let allYears = [...comparisonYears, myPatentYear];

                if (allYears.length === 0) {
                    allYears = [myPatentYear, myPatentYear + 1];
                }

                const minYear = Math.min(...allYears);
                const maxYear = Math.max(...allYears);

                const maxDeviation = Math.max(Math.abs(maxYear - myPatentYear), Math.abs(myPatentYear - minYear));

                // 비교 특허 데이터 변환
                const transformedData: NavigationData[] = comparisonData.map((item) => {
                    const xValue = item.min_distance;

                    let yValue = 0;
                    if (maxDeviation > 0) {
                        yValue = (item.max_filing_year - myPatentYear) / maxDeviation;

                        if (yValue > 1) yValue = 1;
                        if (yValue < -1) yValue = -1;
                    }

                    return {
                        applicant_code: item.applicant_code,
                        applicant_name_rep: item.applicant_name_rep,
                        filing_date: item.max_filing_year ? `${item.max_filing_year}-01-01T00:00:00` : undefined,
                        x_value: xValue,
                        y_value: yValue,
                        score: item.application_count,
                        isMyPatent: false,
                    };
                });

                // 나의 기준 특허 데이터 생성
                const myPatentData: NavigationData = {
                    applicant_code: myPatentItem?.applicant_code ?? '',
                    applicant_name_rep: myPatentItem?.applicant_name_rep ?? '',
                    filing_date: myPatentItem?.max_filing_year ? `${myPatentItem.max_filing_year}-01-01T00:00:00` : (myPatentFilingDate ?? ''),
                    x_value: 0.0,
                    y_value: 0.0,
                    score: myPatentItem?.application_count ?? 0,
                    isMyPatent: true,
                };

                setPlotData([myPatentData, ...transformedData]);
            } catch (err: any) {
                console.error("데이터 로드 실패:", err);
                setError(err.message || "데이터를 불러오는 데 실패했습니다.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [applicationNumber, code, myPatentFilingDate]);

    // Score 기반 위험군 식별
    const comparisonData = plotData.filter(d => !d.isMyPatent);

    const sortedByScore = [...comparisonData].sort((a, b) => a.score - b.score);

    const lowScoreRiskIdentifiers = sortedByScore
        .slice(0, 2)
        .map(d => d.applicant_code);

    // 차트 데이터 준비
    const getColor = (item: NavigationData) => {
        if (item.isMyPatent) return "#4f46e5";

        if (lowScoreRiskIdentifiers.includes(item.applicant_code)) return "#ef4444";

        return "#facc15";
    };

    const scatterData = plotData.map((item) => {
        const isRiskByScore = lowScoreRiskIdentifiers.includes(item.applicant_code);

        const adjustedXValue = item.x_value / 2;

        const size = item.isMyPatent
            ? 200
            : isRiskByScore
                ? 90 + (item.score * 5)
                : 50 + (item.score * 5);

        return {
            ...item,
            x_value: adjustedXValue,
            color: getColor(item),
            size: size,
        };
    });

    // UI 카운트 계산
    const totalCount = scatterData.length;
    const myPatentCount = scatterData.filter(d => d.isMyPatent).length;
    const riskCount = lowScoreRiskIdentifiers.length;
    const otherCount = Math.max(0, totalCount - myPatentCount - riskCount);

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className="w-full animate-pulse space-y-10">
                <div className="h-12 bg-slate-100 rounded-2xl w-1/3" />
                <div className="bg-white rounded-[2.5rem] border border-slate-100 h-[700px]" />
            </div>
        );
    }

    // --- Error State ---
    if (error) {
        return (
            <div className="w-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <AlertCircle className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 font-bold">데이터를 불러올 수 없습니다.</p>
                <p className="text-slate-400 text-sm mt-1">{error}</p>
            </div>
        );
    }

    // --- Empty State ---
    if (!plotData.length) {
        return (
            <div className="w-full py-20 text-center bg-slate-50 rounded-[2.5rem] border border-dashed border-slate-200">
                <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
                <p className="text-slate-500 font-bold">표시할 데이터가 없습니다.</p>
            </div>
        );
    }

    return (
        <div className="w-full text-left font-sans pb-20 mt-20">
            {/* 🏷️ Page Header */}
            <div className="mb-10 space-y-2">
                <h1 className="text-4xl font-black text-slate-900 tracking-tighter">기업 네비게이션 분석</h1>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">
                    Company Navigation & Strategic Positioning
                </p>
            </div>

            {/* 🗺️ Main Card Container */}
            <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">

                {/* [1] 타이틀 섹션 */}
                <div className="bg-slate-900 px-10 py-8 flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-white flex items-center gap-2 uppercase tracking-tight">
                            <LayoutDashboard size={20} className="text-indigo-400" /> Company Positioning Map
                        </h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                            유사특허 보유기업 분포 및 시각화
                        </p>
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                        <Target size={14} className="text-indigo-400" />
                        <span className="text-indigo-200 text-[10px] font-black uppercase tracking-widest">{code}</span>
                    </div>
                </div>

                {/* [2] 🎯 핵심 통계 지표 */}
                <div className="grid grid-cols-1 md:grid-cols-3 bg-slate-50 border-b border-slate-100 text-[15px]">
                    <StatTile label="나의 기업" value={`${myPatentCount}건`} sub="Origin" icon={<Building2 className="text-indigo-500" />} />
                    <StatTile label="유사특허 보유" value={`${riskCount}건`} sub="High Risk" icon={<ShieldAlert className="text-rose-500" />} color="rose" />
                    <StatTile label="기타 비교" value={`${otherCount}건`} sub="Comparisons" icon={<Users className="text-amber-500" />} />
                </div>

                {/* [3] 📊 분포 시각화 그래프 */}
                <div className="p-10 bg-white relative group">
                    <div className="mb-6 flex items-center justify-between">
                        <SectionTitle title="특허 분포 시각화" />
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            {/* <div className="flex items-center gap-2 text-sm font-medium text-slate-400"> */}
                            <History size={12} /> Time Sequence (↑)
                        </div>
                    </div>

                    <div className="bg-slate-50/30 rounded-[2rem] p-6 border border-slate-50 relative overflow-hidden">
                        <ResponsiveContainer width="100%" height={500}>
                            <ScatterChart margin={{ top: 30, right: 80, bottom: 40, left: 40 }}>
                                <defs>
                                    <pattern id="bg-pattern-company" x="0" y="0" width="100%" height="100%" patternUnits="userSpaceOnUse">
                                        <image
                                            href="/images/semicircle-bg.svg"
                                            x="100"
                                            y="0"
                                            width="calc(100% - 50px)"
                                            height="100%"
                                            opacity="0.2"
                                            preserveAspectRatio="none"
                                        />
                                    </pattern>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill="url(#bg-pattern-company)" />

                                <CartesianGrid stroke="none" />

                                <ReferenceLine
                                    y={0}
                                    stroke="#d4d4d8"
                                    strokeWidth={2}
                                    label={{
                                        value: "1/유사도 →",
                                        position: "right",
                                        fill: '#94a3b8',
                                        fontWeight: 900,
                                        fontSize: 11
                                    }}
                                />

                                <XAxis
                                    type="number"
                                    dataKey="x_value"
                                    domain={[0, 0.7]}
                                    hide={true}
                                />

                                <YAxis
                                    type="number"
                                    dataKey="y_value"
                                    domain={[-1.2, 1.2]}
                                    ticks={[]}
                                    axisLine={{ stroke: '#d4d4d8' }}
                                    tickLine={false}
                                />

                                <ZAxis dataKey="size" range={[30, 300]} />

                                <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

                                <Scatter
                                    data={scatterData}
                                    fill="#4f46e5"
                                    shape={(props: any) => {
                                        const payload = props.payload as any;
                                        const isMyPatent = payload.isMyPatent;
                                        const isRiskByScore = lowScoreRiskIdentifiers.includes(payload.applicant_code);

                                        let baseSize = Math.sqrt(props.z || 60) / 0.55;

                                        if (isMyPatent) {
                                            baseSize = baseSize * 1.8;
                                        } else if (isRiskByScore) {
                                            baseSize = baseSize * 1.3;
                                        }

                                        let iconPath = '/images/boat-yellow.png';
                                        if (isMyPatent) {
                                            iconPath = '/images/boat-blue.png';
                                        } else if (isRiskByScore) {
                                            iconPath = '/images/boat-red.png';
                                        }

                                        return (
                                            <image
                                                x={props.cx - baseSize}
                                                y={props.cy - baseSize}
                                                width={baseSize * 2}
                                                height={baseSize * 2}
                                                href={iconPath}
                                                className={isMyPatent ? "" : "cursor-pointer transition-transform duration-200 ease-out hover:scale-125"}
                                                style={{
                                                    filter: 'drop-shadow(0 8px 12px rgba(0,0,0,0.12))',
                                                    transformOrigin: 'center',
                                                    transformBox: 'fill-box'
                                                }}
                                            />
                                        );
                                    }}
                                    onClick={(e: any) => {
                                        if (e?.applicant_code && !e?.isMyPatent) {
                                            handleClick(e.applicant_code, false);
                                        }
                                    }}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 범례 Area */}
                    <div className="mt-8 flex flex-wrap justify-center gap-10">
                        <LegendItem icon="/images/boat-blue.png" label="나의 기업" />
                        <LegendItem icon="/images/boat-red.png" label="침해 위험 기업" />
                        <LegendItem icon="/images/boat-yellow.png" label="기타 기업" />
                    </div>
                </div>

                {/* [4] 🚨 위험/안전 알림 섹션 */}
                <div className="px-10 pb-10">
                    {riskCount > 0 ? (
                        /* 🔥 [위험 상태] */
                        <div className="bg-rose-600 rounded-[2rem] p-8 text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
                            <div className="relative z-10 flex items-start gap-6">
                                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:rotate-12 transition-transform">
                                    <AlertCircle size={28} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black tracking-tight mb-2 uppercase italic">
                                        Score 기준 위험 알림
                                    </h4>
                                    <p className="text-rose-100 text-[15px] leading-relaxed font-medium">
                                        {/* 분석 결과, 총 <strong className="text-white">{(totalCount - myPatentCount).toLocaleString()}개</strong>의 기업 중&nbsp;
                                        <span className="text-white font-black underline underline-offset-4">{riskCount}개</span>의
                                        기업이 유사특허를 보유하고 있습니다. 맵 상의 <span className="text-white font-black">빨간색 선박</span>을 클릭하여
                                        해당 기업을 즉시 검토하십시오.<br /> */}
                                        총 <strong className="text-white">{(totalCount - myPatentCount).toLocaleString()}건</strong>의 비교 특허 중&nbsp;
                                        <span className="text-white font-black underline underline-offset-4">{riskCount}건</span>이 Score (특허 개수) 기준으로 가장 낮습니다.
                                        이는 상대적으로 규모가 작거나 신생 기업일 수 있습니다.
                                    </p>
                                </div>
                            </div>
                            <ShieldAlert size={160} className="absolute -right-12 -bottom-12 text-white/10" />
                        </div>
                    ) : (
                        /* ✅ [안전 상태] */
                        <div className="bg-emerald-600 rounded-[2rem] p-8 text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                            <div className="relative z-10 flex items-start gap-6">
                                <div className="bg-white/20 p-4 rounded-2xl backdrop-blur-sm group-hover:scale-110 transition-transform">
                                    <CheckCircle2 size={28} className="text-white" />
                                </div>
                                <div>
                                    <h4 className="text-xl font-black tracking-tight mb-2 uppercase italic">
                                        안전 상태 알림
                                    </h4>
                                    <p className="text-emerald-100 text-[15px] leading-relaxed font-medium">
                                        축하합니다! 현재 분석 범위 내에서 유사특허 보유 기업이 <span className="text-white font-black underline underline-offset-4">{riskCount}개</span>로&nbsp;
                                        <span className="text-white font-black underline underline-offset-4">고위험 기업이 발견되지 않았습니다.</span>&nbsp;
                                        기타 비교 기업들과의 거리를 유지하며 독자적인 기술 우위를 확보하십시오.
                                    </p>
                                </div>
                            </div>
                            <CheckCircle2 size={160} className="absolute -right-12 -bottom-12 text-white/10" />
                        </div>
                    )}
                </div>

                {/* 🏁 Footer */}
                <div className="px-10 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        💡 선박 아이콘을 클릭하면 해당 출원인의 상세 정보를 확인할 수 있습니다.
                    </p>
                    <span className="text-[10px] font-black text-slate-300 italic">App No.: {applicationNumber}</span>
                </div>
            </div>
        </div>
    );
}

// --- [재사용 컴포넌트] ---

function StatTile({ label, value, sub, icon, color = "indigo" }: any) {
    return (
        <div className="bg-white px-10 py-8 text-left group hover:bg-slate-50 transition-colors border-r last:border-r-0 border-slate-100">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">{icon}</div>
                {/* <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{label}</span> */}
                <span className="text-sm font-medium text-slate-500">{label}</span>
            </div>
            <div className={`text-4xl font-black tracking-tighter mb-1 ${color === 'rose' ? 'text-rose-600' : 'text-slate-900'}`}>
                {value}
            </div>
            <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">{sub}</p>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
    return (
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-slate-800">
            <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
            {title}
        </h3>
    );
}

function LegendItem({ icon, label }: any) {
    return (
        <div className="flex items-center gap-3 group cursor-default">
            <img src={icon} alt={label} className="w-6 h-6 object-contain group-hover:scale-125 transition-transform" />
            {/* <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">{label}</span> */}
            <span className="text-sm font-medium text-slate-500">{label}</span>
        </div>
    );
}
