"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
    Building2, Users, FileText, TrendingUp, MapPin,
    BarChart3, PieChart, ChevronLeft, AlertCircle,
    Plus, Minus, ChevronRight, Phone, Printer,
    Globe, SearchX, BadgeCheck
} from "lucide-react";
import { getAgentStatistics } from "@/lib/api";
import { getLogoManifest, findLogoInManifest } from "@/lib/logo-utils";
import AgentDetailModal from "@/components/patent/AgentDetailModal";

// ==================== 타입 정의 ====================
interface PatentItem {
    application_number: string;
    title: string;
    filing_year?: string;
    cpc_code?: string;
    end_status?: string;
}

interface SectionDetails {
    count: number;
    patents: PatentItem[];
}

interface CompanyStatisticsResponse {
    success: boolean;
    company_info: {
        company_ko: string;
        names: string;
        agent_codes: string;
        address: string;
        phone_number?: string;
        fax?: string;
        homepage?: string;
        star_check: number;
    };
    statistics: {
        total_patent_count: number;
        end_status_distribution: Record<string, number>;
        filing_year_distribution: Record<string, number>;
        cpc_section_distribution: Record<string, number>;
        cpc_section_details?: Record<string, SectionDetails>;
        filing_year_details?: Record<string, SectionDetails>;
    };
}

// ==================== 상수 정의 ====================
const ITEMS_PER_PAGE = 5;

// ==================== 메인 컴포넌트 ====================
export default function AgentCompanyDetail() {
    const t = useTranslations();
    const locale = useLocale();
    const params = useParams();
    const router = useRouter();
    const agentcompany = params?.agentcompany ? decodeURIComponent(params.agentcompany as string) : "";

    // 상태 관리
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CompanyStatisticsResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [expandedCPC, setExpandedCPC] = useState<string | null>(null);
    const [expandedYear, setExpandedYear] = useState<string | null>(null);
    const [cpcPages, setCpcPages] = useState<Record<string, number>>({});
    const [yearPages, setYearPages] = useState<Record<string, number>>({});
    const [selectedAgentCode, setSelectedAgentCode] = useState<string | null>(null);

    // 데이터 로딩
    useEffect(() => {
        if (!agentcompany) return;

        async function fetchData() {
            try {
                setLoading(true);
                setError(null);
                const response = await getAgentStatistics(agentcompany) as CompanyStatisticsResponse;
                setData(response);

                if (response?.company_info?.company_ko) {
                    findCompanyLogo(response.company_info.company_ko);
                }
            } catch (err: any) {
                setError(err.message || t('agent.detail.default_error_message'));
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [agentcompany]);

    // 로고 찾기 (매니페스트 기반 최적화)
    const findCompanyLogo = async (companyName: string) => {
        if (!companyName) return;

        try {
            const manifest = await getLogoManifest();
            const extensions = ['png', 'svg', 'jpg', 'jpeg', 'gif', 'avif'];
            const logoPath = findLogoInManifest(companyName, extensions, manifest);
            setLogoUrl(logoPath);
        } catch (err) {
            console.error("Logo lookup error:", err);
            setLogoUrl(null);
        }
    };

    // 로딩 및 에러 처리
    if (loading) return <LoadingSpinner />;
    if (error || !data) return <ErrorView message={error} />;

    const { company_info, statistics } = data;
    const agentNames = (company_info?.names || "").split(',').map((s: string) => s.trim()).filter(Boolean);
    const agentCodes = (company_info?.agent_codes || "").split(',').map((s: string) => s.trim()).filter(Boolean);
    const hasDetailedData = !!(
        statistics.cpc_section_distribution &&
        Object.keys(statistics.cpc_section_distribution).length > 0
    );

    return (
        <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans antialiased text-slate-900">
            <div className="max-w-7xl mx-auto">

                {/* 뒤로가기 버튼 */}
                <button
                    className="text-slate-500 hover:text-blue-600 mb-6 flex items-center gap-2 font-medium transition-colors"
                    onClick={() => router.back()}
                >
                    <ChevronLeft className="w-5 h-5" /> {t('agent.detail.back_to_list')}
                </button>

                {/* 프로필 카드 */}
                <ProfileCard
                    company_info={company_info}
                    statistics={statistics}
                    logoUrl={logoUrl}
                    agentNames={agentNames}
                />

                {/* 상세 분석 섹션 */}
                {hasDetailedData ? (
                    <>
                        <DetailedAnalysis
                            statistics={statistics}
                            expandedCPC={expandedCPC}
                            setExpandedCPC={setExpandedCPC}
                            expandedYear={expandedYear}
                            setExpandedYear={setExpandedYear}
                            cpcPages={cpcPages}
                            setCpcPages={setCpcPages}
                            yearPages={yearPages}
                            setYearPages={setYearPages}
                        />

                        <BottomSection
                            statistics={statistics}
                            agentNames={agentNames}
                            agentCodes={agentCodes}
                            onSelect={setSelectedAgentCode}
                        />
                    </>
                ) : (
                    <NoDataView
                        agentNames={agentNames}
                        agentCodes={agentCodes}
                        onSelect={setSelectedAgentCode}
                    />
                )}
            </div>

            {/* 변리사 상세 모달 */}
            {selectedAgentCode && (
                <AgentDetailModal
                    agentCode={selectedAgentCode}
                    onClose={() => setSelectedAgentCode(null)}
                />
            )}
        </div>
    );
}

// ==================== 섹션 컴포넌트 ====================

function ProfileCard({ company_info, statistics, logoUrl, agentNames }: any) {
    const t = useTranslations();
    return (
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="bg-slate-900 px-8 py-10 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Building2 className="w-48 h-48 rotate-12" />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                    <div>
                        {/* 사무소 명칭 */}
                        <div className="flex items-center gap-3 mb-4 flex-wrap">
                            <h1 className="text-3xl md:text-4xl font-bold">{company_info.company_ko}</h1>
                            {company_info.star_check === 1 && (
                                <div className="group relative flex items-center">
                                    <BadgeCheck className="w-7 h-7 md:w-8 md:h-8 text-blue-400 fill-blue-400/20 animate-in zoom-in duration-500" />
                                    <span className="absolute left-1/2 -translate-x-1/2 -top-10 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-20">
                                        {t('agent.detail.active_firm_badge')}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 연락처 정보 */}
                        <div className="space-y-2 text-slate-300 text-sm md:text-base">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                                <span>{company_info.address}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span>{company_info.phone_number || t('agent.detail.phone_not_registered')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Printer className="w-4 h-4 text-blue-400 shrink-0" />
                                    <span>{company_info.fax || t('agent.detail.fax_not_registered')}</span>
                                </div>
                                {company_info.homepage && (
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                                        <a
                                            href={company_info.homepage.startsWith('http') ? company_info.homepage : `https://${company_info.homepage}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:text-blue-400 hover:underline transition-colors"
                                        >
                                            {company_info.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 로고 */}
                    {logoUrl && (
                        <div className="bg-white rounded-2xl p-4 shadow-xl shrink-0">
                            <img
                                src={logoUrl}
                                alt="Company Logo"
                                className="w-24 h-24 md:w-32 md:h-32 object-contain"
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* 통계 카드 */}
            <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <StatCard
                    icon={<FileText className="w-6 h-6" />}
                    label={t('agent.detail.total_record_count')}
                    value={t('agent.detail.cases', { count: statistics.total_patent_count })}
                    color="blue"
                />
                <StatCard
                    icon={<Users className="w-6 h-6" />}
                    label={t('agent.detail.partners')}
                    value={t('agent.detail.members_count', { count: agentNames.length })}
                    color="indigo"
                />
            </div>
        </div>
    );
}

function DetailedAnalysis({
    statistics,
    expandedCPC,
    setExpandedCPC,
    expandedYear,
    setExpandedYear,
    cpcPages,
    setCpcPages,
    yearPages,
    setYearPages
}: any) {
    const t = useTranslations();
    const locale = useLocale();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8 items-stretch">
            {/* 기술분야별 비중 */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-full">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" /> {t("agent.detail.tech_distribution")}
                </h3>
                <div className="space-y-6">
                    {(Object.entries(statistics.cpc_section_distribution) as [string, number][])
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, val]) => (
                            <div key={key}>
                                <ProgressBarWithExpand
                                    label={t(`common.cpc_sections.${key}`) || key}
                                    subLabel={key}
                                    value={val}
                                    max={statistics.total_patent_count}
                                    color="bg-blue-600"
                                    isExpanded={expandedCPC === key}
                                    onToggle={() => setExpandedCPC(expandedCPC === key ? null : key)}
                                />
                                {expandedCPC === key && statistics.cpc_section_details?.[key] && (
                                    <PatentList
                                        patents={statistics.cpc_section_details[key].patents}
                                        currentPage={cpcPages[key] || 0}
                                        onPageChange={(p: number) => setCpcPages({ ...cpcPages, [key]: p })}
                                    />
                                )}
                            </div>
                        ))}
                </div>
            </section>

            {/* 연도별 출원 현황 */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-full flex flex-col">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600" /> {t('agent.detail.annual_filing_trends')}
                </h3>
                <div className="space-y-6 flex-1">
                    {statistics.filing_year_distribution && Object.entries(statistics.filing_year_distribution)
                        .sort((a, b) => b[0].localeCompare(a[0]))
                        .map(([year, count]) => (
                            <div key={year}>
                                <ProgressBarWithExpand
                                    label={`${year}${t('common.year')}`}
                                    value={count}
                                    max={Math.max(0, ...(Object.values(statistics.filing_year_distribution) as number[]))}
                                    color="bg-indigo-500"
                                    isExpanded={expandedYear === year}
                                    onToggle={() => setExpandedYear(expandedYear === year ? null : year)}
                                />
                                {expandedYear === year && statistics.filing_year_details?.[year] && (
                                    <PatentList
                                        patents={statistics.filing_year_details[year].patents}
                                        currentPage={yearPages[year] || 0}
                                        onPageChange={(p: number) => setYearPages({ ...yearPages, [year]: p })}
                                    />
                                )}
                            </div>
                        ))}
                </div>
            </section>
        </div>
    );
}

function BottomSection({ statistics, agentNames, agentCodes, onSelect }: any) {
    const PATENT_STATUS = {
        "등록": "registered",  // 심사 통과 후 최종 권리 확보
        "공개": "published",   // 출원 후 1.5년 경과하여 대중에게 노출 (심사 중)
        "거절": "rejected",    // 심사관에 의해 등록이 거절됨
        "포기": "abandoned",   // 출원인이 심사 과정 중 대응을 하지 않아 권리를 포기함
        "취하": "withdrawn",   // 출원인이 스스로 출원 자체를 철회함
        "소멸": "expired",      // 등록 후 연차료 미납이나 기간 만료로 권리가 사라짐
        "출원": "pending"
    };
    const t = useTranslations();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 items-stretch">
            {/* 상태 요약 */}
            <div className="lg:col-span-1">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 h-full">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <PieChart className="text-slate-600" /> {t('agent.detail.status_summary')}
                    </h3>
                    <div className="space-y-4">
                        {statistics.end_status_distribution && Object.entries(statistics.end_status_distribution)
                            .sort((a, b) => (b[1] as number) - (a[1] as number))
                            .map(([status, count]) => (
                                <div key={status} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-slate-600 font-bold">{PATENT_STATUS[status as keyof typeof PATENT_STATUS] ? t(`search.result.${PATENT_STATUS[status as keyof typeof PATENT_STATUS]}`) : status}</span>
                                    <span className="text-slate-900 font-black text-lg">{(count as number).toLocaleString()}</span>
                                </div>
                            ))}
                    </div>
                </div>
            </div>

            {/* 소속 변리사 */}
            <div className="lg:col-span-2">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                    <AgentListSection agentNames={agentNames} agentCodes={agentCodes} onSelect={onSelect} />
                </div>
            </div>
        </div>
    );
}

function NoDataView({ agentNames, agentCodes, onSelect }: any) {
    const t = useTranslations();
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8 items-stretch">
            <div className="lg:col-span-2">
                <div className="bg-white py-20 px-12 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center text-center h-full min-h-[480px] justify-center">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                        <SearchX className="w-12 h-12 text-slate-300" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-3">{t('agent.detail.no_data_title')}</h3>
                    <p className="text-slate-500 max-w-sm text-lg leading-relaxed mb-10">
                        {t('agent.detail.no_data_desc')}
                    </p>
                    <div className="flex gap-3">
                        <span className="px-5 py-2.5 bg-slate-100 text-slate-600 rounded-full text-sm font-bold border border-slate-200">{t('agent.detail.basic_info_provided')}</span>
                        <span className="px-5 py-2.5 bg-blue-50 text-blue-600 rounded-full text-sm font-bold border border-blue-100 text-nowrap">{t('agent.detail.waiting_for_analysis')}</span>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-1">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
                    <AgentListSection agentNames={agentNames} agentCodes={agentCodes} onSelect={onSelect} />
                </div>
            </div>
        </div>
    );
}

// ==================== UI 컴포넌트 ====================

function AgentListSection({ agentNames, agentCodes, onSelect }: any) {
    const t = useTranslations();
    return (
        <>
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="text-lg font-bold text-slate-900">{t('agent.detail.member_attorneys')}</h3>
                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
                    {t('agent.detail.total_members', { count: agentNames.length })}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto bg-white min-h-[300px]">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold sticky top-0">
                        <tr>
                            <th className="px-8 py-4">{t('agent.detail.attorney_name')}</th>
                            <th className="px-8 py-4 text-right">{t('agent.detail.view_details')}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {agentNames.map((name: string, i: number) => (
                            <tr
                                key={i}
                                className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                                onClick={() => onSelect(agentCodes[i])}
                            >
                                <td className="px-8 py-4 font-bold text-slate-700 group-hover:text-blue-600">{name}</td>
                                <td className="px-8 py-4 text-right">
                                    <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-300 group-hover:text-blue-600 transition-colors">
                                        {t('agent.detail.detail_info')}
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
}

function StatCard({ icon, label, value, color }: any) {
    const colorMap: Record<string, string> = {
        blue: "text-blue-600 bg-blue-50",
        indigo: "text-indigo-600 bg-indigo-50"
    };

    return (
        <div className="flex items-center gap-5 p-6 rounded-2xl bg-slate-50 border border-slate-100">
            <div className={`p-4 rounded-xl ${colorMap[color]}`}>{icon}</div>
            <div>
                <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                <p className="text-xl font-bold text-slate-900">{value}</p>
            </div>
        </div>
    );
}

function ProgressBarWithExpand({ label, subLabel, value, max, color, isExpanded, onToggle }: any) {
    const t = useTranslations();
    const percentage = (value / max) * 100;

    return (
        <div className="group">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <span className="text-slate-800 font-bold block leading-tight">{label}</span>
                    {subLabel && <span className="text-[10px] text-slate-400 font-mono">{subLabel}</span>}
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-slate-900 font-bold text-sm">{t('agent.detail.cases', { count: value })}</span>
                    <button onClick={onToggle} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors">
                        {isExpanded ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>
                </div>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                    className={`h-full ${color} transition-all duration-700 ease-out`}
                    style={{ width: `${Math.max(percentage, 2)}%` }}
                />
            </div>
        </div>
    );
}

function PatentList({ patents, currentPage, onPageChange }: any) {
    const currentItems = patents.slice(
        currentPage * ITEMS_PER_PAGE,
        (currentPage + 1) * ITEMS_PER_PAGE
    );

    return (
        <div className="mt-4 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-top-2">
            <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                    {currentItems.map((p: PatentItem, i: number) => (
                        <tr key={i} className="hover:bg-white transition-colors">
                            <td className="px-4 py-3 font-mono text-[10px] text-blue-600 w-32 shrink-0">
                                {p.application_number}
                            </td>
                            <td className="px-4 py-3 text-slate-700 truncate max-w-[200px]">
                                {p.title}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400 text-[10px]">
                                {p.filing_year}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function LoadingSpinner() {
    const t = useTranslations();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-bold animate-pulse">{t('agent.detail.loading_analysis')}</p>
        </div>
    );
}

function ErrorView({ message }: { message: string | null }) {
    const t = useTranslations();
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="max-w-md w-full text-center p-10 bg-white rounded-3xl shadow-xl border border-slate-100">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{t('agent.detail.data_load_error')}</h2>
                <p className="text-slate-500 mb-8 leading-relaxed">
                    {message || t('agent.detail.default_error_message')}
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                    {t('agent.detail.refresh')}
                </button>
            </div>
        </div>
    );
}