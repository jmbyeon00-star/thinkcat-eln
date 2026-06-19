"use client";
import { useEffect, useState } from "react";
import { useRouter } from "@/routing";
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ZAxis,
    ReferenceLine,
} from "recharts";
import { applicantByNavigate, getApplicantNavigate } from "@/lib/api";
import { Network, AlertCircle, CheckCircle2, Ship } from "lucide-react";



// --- 타입 정의 ---
type ApplicantData = {
    applicant_code: string;
    applicant_name_rep: string;
    min_distance: number; 
    max_filing_year: number; 
    application_count: number; 
};

type ApplicantApiResponse = {
    success: boolean;
    total_count: number;
    data: ApplicantData[];
};

type NavigationData = {
    applicant_code: string;
    applicant_name_rep: string; 
    filing_date?: string;       
    x_value: number;            
    y_value: number;            
    score: number;              
    isMyPatent?: boolean;
    raw_distance?: number;
    color?: string;
};

type PatNavigationProps = {
    applicationNumber: string; 
    code: string; 
    myPatentFilingDate?: string; 
};



// --- CustomTooltip 컴포넌트 ---
const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const isMyPatent = data.isMyPatent;

        return (
            <div className="bg-white px-4 py-3 rounded-xl shadow-xl border border-slate-100">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">
                    {isMyPatent ? "기준 기업 정보" : "기업 정보 상세"}
                </p>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">기업명:</span>
                        <span className="font-bold text-slate-900">{data.applicant_name_rep}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-slate-500 font-medium">출원인 코드:</span>
                        <span className="font-bold text-slate-900">{data.applicant_code}</span>
                    </div>
                    <div className="pt-1 mt-1 border-t border-slate-50 flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                        <span className="font-black" style={{ color: data.color }}>
                            {isMyPatent ? "나의 기준 기업" : data.color === "#ef4444" ? "유사특허 보유기업" : "기타 기업"}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

// --- 메인 컴포넌트 ---
export default function ApplicantNavigationChart({
    applicationNumber,
    code,
    myPatentFilingDate 
}: PatNavigationProps) {
    const router = useRouter();
    const [plotData, setPlotData] = useState<NavigationData[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!applicationNumber || !code) return;

        const fetchData = async () => {
            try {
                setIsLoading(true);
                // const apiResult = await applicantByNavigate(applicationNumber, code);
                const apiResult = (await getApplicantNavigate(applicationNumber, code)) as ApplicantApiResponse;
                
                if (!apiResult || !Array.isArray(apiResult.data)) {
                    setPlotData([]);
                    return;
                }

                const rawData: ApplicantData[] = apiResult.data;
                const myPatentItem = rawData.find(item => item.min_distance === 0);
                const myPatentYear = myPatentItem?.max_filing_year || 
                    (myPatentFilingDate ? parseInt(myPatentFilingDate.substring(0, 4), 10) : 2024);
                
                const comparisonData = rawData.filter(item => item.min_distance !== 0);
                const distances = comparisonData.length > 0 ? comparisonData.map(d => d.min_distance) : [0];
                const minDist = Math.min(...distances);
                const maxDist = Math.max(...distances);

                const comparisonYears = comparisonData.map(d => d.max_filing_year).filter(Boolean);
                const allYears = [...comparisonYears, myPatentYear];
                const minYear = Math.min(...allYears);
                const maxYear = Math.max(...allYears);
                const maxDeviation = Math.max(Math.abs(maxYear - myPatentYear), Math.abs(myPatentYear - minYear));

                const transformedData: NavigationData[] = comparisonData.map((item) => {
                    // X축 정규화 (Y축에서 뿜어져 나오는 형태를 위해 0.15~0.8 구간 활용)
                    const normalizedX = 0.15 + ((item.min_distance - minDist) / (maxDist - minDist || 1)) * 0.65;
                    let yValue = 0;
                    if (maxDeviation > 0) {
                        yValue = (item.max_filing_year - myPatentYear) / maxDeviation;
                        yValue = Math.max(-1, Math.min(1, yValue));
                    }

                    return {
                        applicant_code: item.applicant_code,
                        applicant_name_rep: item.applicant_name_rep,
                        x_value: normalizedX,
                        y_value: yValue,
                        score: item.application_count,
                        isMyPatent: false,
                        raw_distance: item.min_distance,
                    };
                });

                const myPatentData: NavigationData = {
                    applicant_code: myPatentItem?.applicant_code ?? '',
                    applicant_name_rep: myPatentItem?.applicant_name_rep ?? '기준 기업',
                    x_value: 0.0,
                    y_value: 0.0,
                    score: myPatentItem?.application_count ?? 0,
                    isMyPatent: true,
                    raw_distance: 0,
                };
                
                setPlotData([myPatentData, ...transformedData]); 
            } catch (err) {
                console.error("데이터 로드 실패:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [applicationNumber, code, myPatentFilingDate]);

    // 위험도 식별 로직
    const activeComparisonData = plotData.filter(d => !d.isMyPatent);
    const minRawDistance = activeComparisonData.length > 0 
        ? Math.min(...activeComparisonData.map(d => d.raw_distance ?? Infinity))
        : 0;

    const sorted = [...activeComparisonData].sort(
        (a,b) => (a.raw_distance ?? 1) - (b.raw_distance ?? 1)
    );

    const riskCodes = new Set(
        sorted.slice(0, 2).map(d => d.applicant_code)
    );

    const scatterData = plotData.map((item) => {
        const isNearRisk = riskCodes.has(item.applicant_code);

        return {
            ...item,
            color: item.isMyPatent
                ? "#2563eb"
                : isNearRisk
                ? "#ef4444"
                : "#facc15",
            isNearRisk
        };
    });



    const riskCount = scatterData.filter(d => d.isNearRisk).length;
    const totalCount = scatterData.length;

    if (isLoading) return <div className="w-full h-96 bg-slate-50 animate-pulse rounded-[1.5rem] border border-slate-100" />;

    return (
        <div className="w-full text-left font-sans space-y-6">
            {/* 🏷️ 상단 제목 영역 */}
            <div className="mb-8 flex items-start gap-4">
                <Network className="text-indigo-600 shrink-0 mt-1" size={56} /> 
                <div className="flex flex-col">
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter mb-1">
                        기업 네비게이션 분석
                    </h1>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        유사특허 보유기업 분포 및 시각화 리포트
                    </p>
                </div>
            </div>

            {/* 🗺️ 메인 카드 컨테이너 */}
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                <div className="bg-[#0f172a] px-8 py-7 border-b border-slate-800">
                    <h2 className="text-2xl font-black text-white tracking-tighter">기업 포지셔닝 맵</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest opacity-80">
                        Company Navigation & Positioning Map
                    </p>
                </div>

                <div className="p-8 space-y-6">
                    <SectionTitle title="기업 분포 시각화" />
                    {/* 차트 영역 */}
                    <div className="bg-white rounded-[2rem] border border-slate-100 p-0 relative overflow-hidden h-[500px]">
                        <div className="absolute left-[30px] top-10 z-20">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded border border-slate-100 shadow-sm backdrop-blur-sm">↑ 최근</span>
                        </div>
                        <div className="absolute right-[40px] top-1/2 -translate-y-1/2 -mt-1 z-20">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded border border-slate-100 shadow-sm backdrop-blur-sm">유사도 감소 →</span>
                        </div>
                        <div className="absolute left-[20px] bottom-[40px] z-20 translate-y-1/2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 px-2 py-0.5 rounded border border-slate-100 shadow-sm backdrop-blur-sm">↓ 오래전</span>
                        </div>

                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 40, right: 160, bottom: 40, left: 40 }}>
                                <defs>
                                    <pattern id="semicircle-bg" x="-1%" y="0" width="105%" height="100%" patternUnits="userSpaceOnUse">
                                        <image href="/images/semicircle-bg.svg" x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" style={{ opacity: 0.15 }} />
                                    </pattern>
                                </defs>
                                <rect x="0" y="0" width="100%" height="100%" fill="url(#semicircle-bg)" />
                                <XAxis type="number" dataKey="x_value" domain={[0, 1]} hide />
                                <YAxis type="number" dataKey="y_value" domain={[-1.2, 1.2]} axisLine={{ stroke: '#cbd5e1' }} tick={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <ReferenceLine y={0} stroke="#cbd5e1" strokeWidth={1} />
                                <Scatter
                                    data={scatterData}
                                    shape={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        const baseSize = payload.isMyPatent ? 36 : payload.isNearRisk ? 24 : 16;
                                        const iconPath = payload.isMyPatent ? '/images/boat-blue.png' : payload.isNearRisk ? '/images/boat-red.png' : '/images/boat-yellow.png';
                                        return (
                                            <image
                                                x={cx - baseSize} y={cy - baseSize}
                                                width={baseSize * 2} height={baseSize * 2}
                                                href={iconPath}
                                                className="cursor-pointer" // 🎯 애니메이션 효과 제거 상태 유지
                                                style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}
                                                onClick={() => !payload.isMyPatent && router.push(`/company/${payload.applicant_code}`)}
                                            />
                                        );
                                    }}
                                />
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>

                    {/* 하단 범례 */}
                    <div className="flex justify-center pt-2">
                        <div className="bg-slate-50/80 rounded-2xl border border-slate-100 p-4 px-10 flex items-center gap-10">
                            <LegendItem img="/images/boat-blue.png" label="나의 기업" color="text-blue-600" />
                            <LegendItem img="/images/boat-red.png" label="유사기업" color="text-red-600" />
                            <LegendItem img="/images/boat-yellow.png" label="기타 기업" color="text-amber-500" />
                        </div>
                    </div>

                    {/* 위험 알람 섹션 */}
                    <div className="bg-rose-50/50 rounded-2xl p-6 border border-rose-100 flex gap-4 items-start">
                        <div className="bg-rose-500 text-white p-2.5 rounded-xl shadow-lg shadow-rose-100">
                            <AlertCircle size={20} />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-black text-rose-900 uppercase tracking-tight">유사특허 보유기업 알림</h4>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                분석된 <strong className="text-rose-600">{totalCount.toLocaleString()}건</strong>의 특허 중{" "}
                                <strong className="text-rose-600 font-black underline decoration-rose-200 underline-offset-4">{riskCount}건</strong>이 
                                위험 수준의 높은 유사도를 보입니다. 자동차 아이콘을 클릭하여 상세 정보를 확인하세요.
                            </p>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 px-1">
      <div className="w-1 h-3 bg-indigo-600 rounded-full" /> {title}
    </h3>
  );
}
function LegendItem({ img, label, color }: { img: string; label: string; color: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <img src={img} alt={label} className="w-6 h-6 drop-shadow-sm" />
            <span className={`text-[11px] font-black uppercase tracking-tight ${color}`}>{label}</span>
        </div>
    );
}