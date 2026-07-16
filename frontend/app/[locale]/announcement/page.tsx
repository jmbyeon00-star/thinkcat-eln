'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search } from 'lucide-react';
import { getStats, calculateDday } from '@/lib/api';
import { apiFetch } from '@/lib/apiFetch';
import PageShell from '@/components/layouts/PageShell';

// 1. 데이터 인터페이스 정의
interface Project {
    id: number;
    organization: string;
    title: string;
    URL?: string;
    announcement_date?: string;
    start_date?: string;
    end_date: string;
    status: string;
    budget?: string;
    government_support?: string;
    dday?: string;
}

const ResearchProjectsPage = () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    // --- 상태 관리 ---
    const [tempSearchTerm, setTempSearchTerm] = useState('');
    const [tempSelectedAgency, setTempSelectedAgency] = useState('');
    const [tempSelectedStatus, setTempSelectedStatus] = useState('전체');
    const [tempStartDate, setTempStartDate] = useState('');
    const [tempEndDate, setTempEndDate] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAgency, setSelectedAgency] = useState<string[]>([]);
    const [selectedStatus, setSelectedStatus] = useState('전체');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [currentPage, setCurrentPage] = useState(1);
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const [projects, setProjects] = useState<Project[]>([]);
    const [allProjects, setAllProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState(null);
    const [totalCount, setTotalCount] = useState(0);
    const [totalPages, setTotalPages] = useState(1);

    // 정부지원금 편집 상태
    const [editingGovId, setEditingGovId] = useState<number | null>(null);
    const [govValue, setGovValue] = useState('');
    const [govError, setGovError] = useState('');

    const formatBudget = (budget: string | null | undefined): string => {
        if (!budget || budget === '0') return '-';
        const num = parseInt(budget, 10);
        if (isNaN(num) || num === 0) return '-';
        const eok = num / 100000000;
        return eok % 1 === 0 ? `${eok}억` : `${parseFloat(eok.toFixed(2))}억`;
    };

    // ============================================
    // 초기 로딩: 통계용 전체 데이터
    // ============================================
    useEffect(() => {
        async function loadAllData() {
            try {
                setLoading(true);
                setError(null);
                const response = await apiFetch(`${API_BASE}/api/announcements?page=1&page_size=1000`);
                if (!response.ok) throw new Error(`API 오류: ${response.status}`);

                const data = await response.json();
                const projectsWithDday = data.items.map((project: Project) => ({
                    ...project,
                    id: project.id,
                    dday: calculateDday(project.end_date)
                }));

                setAllProjects(projectsWithDday);
                const statsData = await getStats();
                setStats(statsData);
            } catch (err: any) {
                console.error(err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        loadAllData();
    }, [API_BASE]);

    // ============================================
    // 페이지/필터 변경 시 데이터 로드
    // ============================================
    useEffect(() => {
        async function loadPageData() {
            try {
                setLoading(true);
                const params = new URLSearchParams({
                    page: currentPage.toString(),
                    page_size: '20',
                    sort_field: sortField || '',
                    sort_order: sortDirection
                });

                if (searchTerm) params.append('keyword', searchTerm);
                if (selectedAgency.length > 0) params.append('organization', selectedAgency.join(','));
                if (selectedStatus && selectedStatus !== '전체') params.append('status', selectedStatus);
                if (startDate) params.append('start_date', startDate);
                if (endDate) params.append('end_date', endDate);

                const response = await apiFetch(`${API_BASE}/api/announcements?${params.toString()}`);
                if (!response.ok) throw new Error(`API 오류: ${response.status}`);

                const data = await response.json();
                const projectsWithDday = data.items.map((project: Project) => ({
                    ...project,
                    id: project.id,
                    dday: calculateDday(project.end_date)
                }));

                setProjects(projectsWithDday);
                setTotalCount(data.total);
                setTotalPages(data.total_pages);
            } catch (err) {
                console.error('페이지 로딩 실패:', err);
            } finally {
                setLoading(false);
            }
        }

        if (allProjects.length > 0) {
            loadPageData();
        }
    }, [currentPage, searchTerm, selectedAgency, selectedStatus, startDate, endDate, allProjects.length, sortField, sortDirection, API_BASE]);

    // --- 핸들러 함수들 ---
    const handleSearch = () => {
        setSearchTerm(tempSearchTerm);
        setSelectedAgency(tempSelectedAgency ? [tempSelectedAgency] : []);
        setSelectedStatus(tempSelectedStatus);
        setStartDate(tempStartDate);
        setEndDate(tempEndDate);
        setCurrentPage(1);
    };

    const toggleAgency = (agencyName: string) => {
        setSelectedAgency(prev => {
            const next = prev.includes(agencyName)
                ? prev.filter((a: string) => a !== agencyName)
                : [...prev, agencyName];
            setTempSelectedAgency(next.length === 1 ? next[0] : '');
            return next;
        });
        setCurrentPage(1);
    };

    const handleReset = () => {
        setTempSearchTerm('');
        setTempSelectedAgency('');
        setTempSelectedStatus('전체');
        setTempStartDate('');
        setTempEndDate('');
        setSearchTerm('');
        setSelectedAgency([]);
        setSelectedStatus('전체');
        setStartDate('');
        setEndDate('');
        setCurrentPage(1);
    };

    const handleGovClick = (project: Project) => {
        setEditingGovId(project.id);
        setGovValue(project.government_support || '');
        setGovError('');
    };

    const validateGov = (value: string, budget: string | undefined): { valid: boolean; message: string } => {
        if (!value.trim()) return { valid: true, message: '' };
        const num = parseFloat(value);
        if (isNaN(num) || !/^\d+(\.\d+)?$/.test(value.trim())) return { valid: false, message: '숫자만 입력 가능 (단위: 억)' };
        if (budget && budget !== '0') {
            const budgetEok = parseInt(budget, 10) / 100000000;
            if (num > budgetEok) return { valid: false, message: `공고금액(${budgetEok}억) 초과 불가` };
        }
        return { valid: true, message: '' };
    };

    const handleGovChange = (e: React.ChangeEvent<HTMLInputElement>, budget: string | undefined) => {
        const value = e.target.value;
        if (value && !/^[\d.]*$/.test(value)) return;
        setGovValue(value);
        const validation = validateGov(value, budget);
        setGovError(validation.valid ? '' : validation.message);
    };

    const saveGov = async (project: Project) => {
        const validation = validateGov(govValue, project.budget);
        if (!validation.valid) { setGovError(validation.message); return; }
        try {
            const response = await apiFetch(`${API_BASE}/api/announcements/${project.id}/government-support`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ government_support: govValue.trim() }),
            });
            if (!response.ok) throw new Error('저장 실패');
            setProjects(prev => prev.map(p => p.id === project.id ? { ...p, government_support: govValue.trim() } : p));
            setEditingGovId(null);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '저장 실패';
            setGovError(errorMessage);
        }
    };

    const cancelGovEdit = () => { setEditingGovId(null); setGovValue(''); setGovError(''); };

    const handleGovKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, project: Project) => {
        if (e.key === 'Enter') { e.preventDefault(); saveGov(project); }
        else if (e.key === 'Escape') cancelGovEdit();
    };

    // --- 메모이제이션 데이터 ---
    const allAgencies = useMemo(() => {
        const statsMap: Record<string, number> = {};
        allProjects.forEach(project => { statsMap[project.organization] = (statsMap[project.organization] || 0) + 1; });
        return Object.entries(statsMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    }, [allProjects]);

    const agencyStatsTop10 = useMemo(() => allAgencies.slice(0, 10), [allAgencies]);

    const handleSort = (field: string) => {
        if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDirection('asc'); }
        setCurrentPage(1);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case '접수중': return 'bg-green-100 text-green-800';
            case '접수예정': return 'bg-yellow-100 text-yellow-800';
            case '마감': return 'bg-zinc-100 text-zinc-800';
            default: return 'bg-zinc-100 text-zinc-800';
        }
    };

    // --- 렌더링 ---
    if (loading && allProjects.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-zinc-600 font-medium">데이터 로딩 중...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center bg-white p-8 rounded-xl shadow-lg max-w-md">
                    <div className="text-red-500 text-5xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-zinc-800 mb-2">오류 발생</h2>
                    <p className="text-zinc-600 mb-4">{error}</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">다시 시도</button>
                </div>
            </div>
        );
    }

    return (
        <PageShell
            title="R&D공고"
            description="정부·공공기관의 R&D 과제 공고를 통합 검색하고 지원 기회를 확인하세요."
        >
            <>

                {/* Search Section */}
                <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 mb-8 border border-zinc-100">
                    <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }}>
                        <div className="space-y-6">
                            <div>
                                <label className="flex items-center text-sm font-semibold text-zinc-700 mb-2">
                                    <span className="w-1 h-4 bg-blue-500 mr-2"></span>공고명
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="키워드를 입력해주세요."
                                        value={tempSearchTerm}
                                        onChange={(e) => setTempSearchTerm(e.target.value)}
                                        className="w-full px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none hover:border-blue-500 focus:border-blue-500 focus:shadow-[0_0_15px_rgba(37,99,235,0.25)] text-zinc-900 bg-white"
                                    />
                                    <Search className="absolute right-3 top-3.5 text-zinc-400" size={20} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-zinc-700 mb-2">
                                        <span className="w-1 h-4 bg-blue-500 mr-2"></span>공고기관명
                                    </label>
                                    <select
                                        value={tempSelectedAgency}
                                        onChange={(e) => setTempSelectedAgency(e.target.value)}
                                        className={`w-full px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none hover:border-blue-500 focus:border-blue-500 bg-white ${tempSelectedAgency === '' ? 'text-zinc-400' : 'text-zinc-900'}`}
                                    >
                                        <option value="">전체</option>
                                        {allAgencies.map((stat) => <option key={stat.name} value={stat.name}>{stat.name} ({stat.count})</option>)}
                                    </select>
                                    {selectedAgency.length > 1 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {selectedAgency.map((name) => (
                                                <span key={name} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-medium rounded-full">
                                                    {name}
                                                    <button type="button" onClick={() => toggleAgency(name)} className="hover:text-blue-900 leading-none">×</button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="flex items-center text-sm font-semibold text-zinc-700 mb-2">
                                        <span className="w-1 h-4 bg-blue-500 mr-2"></span>진행
                                    </label>
                                    <div className="flex items-center gap-8 px-4 py-3 h-[52px]">
                                        {['전체', '접수중', '접수예정'].map((status) => (
                                            <label key={status} className="flex items-center">
                                                <input type="radio" name="tempStatus" value={status} checked={tempSelectedStatus === status} onChange={(e) => setTempSelectedStatus(e.target.value)} className="w-4 h-4 text-blue-500" />
                                                <span className="ml-2 text-zinc-900 text-sm">{status}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="flex items-center text-sm font-semibold text-zinc-700 mb-2">
                                        <span className="w-1 h-4 bg-blue-500 mr-2"></span>공고일
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} className="flex-1 px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none text-zinc-400" />
                                        <span className="text-zinc-700 text-sm">~</span>
                                        <input type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} className="flex-1 px-4 py-3 border-2 border-zinc-200 rounded-xl outline-none text-zinc-400" />
                                    </div>
                                </div>
                                <div className="flex items-end gap-3">
                                    <button onClick={handleSearch} className="px-16 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-semibold rounded-xl transform hover:scale-105 h-[52px]">검색</button>
                                    <button type="button" onClick={handleReset} className="px-6 py-3 bg-zinc-100 text-zinc-600 font-semibold rounded-xl hover:bg-zinc-200 transition h-[52px]">초기화</button>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Agency Shortcuts */}
                <div className="mb-8">
                    <h3 className="text-xl font-bold text-zinc-800 mb-4">공고기관 바로가기</h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
                        {agencyStatsTop10.map((stat) => (
                            <div key={stat.name} className="flex flex-col items-center">
                                <button onClick={() => toggleAgency(stat.name)} className={`w-full p-3 rounded-lg transition-all ${selectedAgency.includes(stat.name) ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white' : 'bg-[#F0F7FF] text-zinc-800 hover:bg-blue-100'}`}>
                                    <div className="text-[10px] font-medium line-clamp-2 h-8">{stat.name}</div>
                                </button>
                                <div className="text-[11px] text-zinc-500 mt-1">({stat.count})</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Results Table */}
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-zinc-100">
                    <div className="flex justify-end items-center px-4 pt-2 gap-1">
                        <span className="text-xs text-zinc-500 mr-2">검색된 정보: <span className="font-bold text-blue-600">{totalCount}</span>건</span>
                        <button onClick={() => setCurrentPage(1)} disabled={currentPage===1} className="px-1 text-xs text-zinc-400 hover:text-blue-600 disabled:opacity-30">«</button>
                        <button onClick={() => setCurrentPage(Math.max(1, currentPage-1))} disabled={currentPage===1} className="px-1 text-xs text-zinc-400 hover:text-blue-600 disabled:opacity-30">‹</button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const pageNum = Math.floor((currentPage-1)/5)*5+i+1;
                            return pageNum <= totalPages ? (
                                <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-6 h-6 text-xs rounded-full ${currentPage===pageNum ? 'bg-blue-600 text-white' : 'text-zinc-500 hover:text-blue-600'}`}>{pageNum}</button>
                            ) : null;
                        })}
                        <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage+1))} disabled={currentPage===totalPages} className="px-1 text-xs text-zinc-400 hover:text-blue-600 disabled:opacity-30">›</button>
                        <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage===totalPages} className="px-1 text-xs text-zinc-400 hover:text-blue-600 disabled:opacity-30">»</button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gradient-to-r from-zinc-50 to-zinc-100 border-b border-zinc-200">
                                <tr>
                                    <th className="px-1 py-3 text-center text-xs font-bold text-zinc-700 uppercase w-3"></th>
                                    <th className="px-2 py-3 text-center text-xs font-bold text-zinc-700 uppercase">공고명</th>
                                    <th className="px-2 py-3 text-center text-xs font-bold text-zinc-700 uppercase w-36">공고기관</th>
                                    <th className="px-1 py-3 text-center text-xs font-bold text-zinc-700 uppercase w-16">현황</th>
                                    <th className="px-1 py-3 text-center text-xs font-bold text-zinc-700 uppercase w-20">
                                        <button onClick={() => handleSort('start_date')} className="flex items-center justify-center w-full gap-1">접수일 <span>{sortField === "start_date" ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span></button>
                                    </th>
                                    <th className="px-1 py-3 text-center text-xs font-bold text-zinc-700 uppercase w-20">
                                        <button onClick={() => handleSort('end_date')} className="flex items-center justify-center w-full gap-1">마감일 <span>{sortField === "end_date" ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}</span></button>
                                    </th>
                                    <th className="px-2 py-3 text-center text-xs font-bold text-zinc-700 w-36">
                                        정부지원금/공고금액<br />
                                        <span className="text-[9px] font-light text-zinc-400">(단위: 억)</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200">
                                {projects.map((project, index) => (
                                    <tr key={project.id} className="hover:bg-blue-50/50 transition">
                                        <td className="px-1 py-2 text-center text-xs font-medium text-zinc-500">{(currentPage - 1) * 20 + index + 1}</td>
                                        <td className="px-2 py-2 text-left">
                                            <a href={project.URL} target="_blank" className="text-sm text-zinc-900 hover:text-blue-600 hover:underline">{project.title}</a>
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                            <button onClick={() => toggleAgency(project.organization)} className="text-[12px] text-blue-600 hover:underline font-medium">{project.organization}</button>
                                        </td>
                                        <td className="px-1 py-2 text-center">
                                            <span className={`inline-block px-2 py-1 text-[11px] font-medium text-black rounded-full w-[60px] ${getStatusColor(project.status)}`}>{project.status}</span>
                                        </td>
                                        <td className="px-1 py-2 text-center text-[12px] text-zinc-600">{project.start_date}</td>
                                        <td className="px-1 py-2 text-center">
                                            <div className="text-[12px] text-zinc-600">{project.end_date}</div>
                                            <div className="text-[11px] font-bold text-red-600 mt-0.5">{project.dday}</div>
                                        </td>
                                        <td className="px-2 text-center relative" style={{height: '44px'}} onMouseEnter={() => handleGovClick(project)} onMouseLeave={() => { if (editingGovId === project.id && !govValue) cancelGovEdit(); }}>
                                            {editingGovId === project.id ? (
                                                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-20 bg-white border border-blue-200 rounded-lg shadow-lg px-2 py-1.5 flex flex-col items-center gap-1 w-32">
                                                    <input type="text" value={govValue} onChange={(e) => handleGovChange(e, project.budget)} onKeyDown={(e) => handleGovKeyDown(e, project)} autoFocus placeholder="억 단위" className={`w-full text-[12px] border-2 rounded ${govError ? 'border-red-500' : 'border-blue-500'} outline-none text-center`} />
                                                    {govError && <div className="text-[9px] text-red-500 w-full text-center">{govError}</div>}
                                                    <div className="flex gap-1">
                                                        <button onClick={() => saveGov(project)} className="px-2 py-0.5 bg-blue-500 text-white text-[9px] rounded">저장</button>
                                                        <button onClick={cancelGovEdit} className="px-2 py-0.5 bg-zinc-300 text-[9px] rounded">취소</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[12px] text-zinc-700 hover:bg-blue-50 px-2 py-1 rounded transition cursor-pointer">
                                                    <span className="text-zinc-500">{project.government_support ? `${project.government_support}억` : '-'}</span>
                                                    <span className="text-zinc-300 mx-0.5">/</span>
                                                    <span className="text-zinc-500">{formatBudget(project.budget)}</span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination */}
                <div className="mt-8 flex justify-center items-center space-x-1">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 text-zinc-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                    <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 disabled:opacity-30">‹</button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.floor((currentPage - 1) / 5) * 5 + i + 1;
                        return pageNum <= totalPages ? (
                            <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`w-10 h-10 flex items-center justify-center text-sm font-medium rounded-full transition ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'text-zinc-600 hover:text-blue-600'}`}>{pageNum}</button>
                        ) : null;
                    })}
                    <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 disabled:opacity-30">›</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 text-zinc-600 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
                </div>

                <div className="mt-6 text-center text-sm text-zinc-600">검색된 정보: <span className="font-bold text-blue-600">{totalCount} 건</span></div>
            </>
        </PageShell>
    );
};

export default ResearchProjectsPage;
