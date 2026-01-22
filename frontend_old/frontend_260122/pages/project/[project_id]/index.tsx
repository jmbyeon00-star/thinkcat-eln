// pages/project/[project_id]/index.tsx (혹은 해당 페이지 파일)
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { Database, ChevronRight, ChevronDown, ChevronUp, Cpu, Loader2, TrendingUp, Plus, Pencil, Check, X, Zap } from "lucide-react";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";
import Link from "next/link";

import { authHeader } from "@/utils/common";
import { setDatetimeToDate } from "@/utils/common"
import { api } from "@/lib/apiClient";

import { withMessages } from '@/lib/i18n/withMessages';
import { CollectionInfo } from "@/types/collection";
import { ProjectInfo } from "@/types/project";
import { ModelDetail } from "@/types/ai";
export const getServerSideProps = withMessages();

const projectData = {
    // ... (더미 데이터는 그대로 유지)
    status: "진행중",
    recentActivities: [
        { action: "모델 '100-13' 학습 완료", time: "2시간 전" },
        { action: "데이터 50개 추가", time: "1일 전" },
        { action: "프로젝트 생성", time: "3일 전" },
    ],
};

export default function ProjectHomePage() {
    const router = useRouter();
    // project_id가 배열일 경우 대비하여 첫 번째 요소만 사용
    const project_id = Array.isArray(router.query.project_id)
        ? router.query.project_id[0]
        : router.query.project_id;

    const { data: session } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [loading, setLoading] = useState(true);
    const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
    const [collectionInfo, setCollectionInfo] = useState<CollectionInfo[]>([]);
    const [models, setModels] = useState<ModelDetail[]>([])


    // >>> 프로젝트 구조 도형 노드 관련 로직
    // 1. 로직 부분: 실시간 추적 및 좌표 정밀 계산
    const names = useMemo(() =>
        Array.from({ length: 35 }, (_, i) => `컬렉션 ${i + 1}`),
        []);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [isAtBottom, setIsAtBottom] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const wrapRef = useRef<HTMLDivElement | null>(null);
    const projectRef = useRef<HTMLDivElement | null>(null);
    const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [paths, setPaths] = useState<string[]>([]);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        // 기존 연결선 재계산 함수 호출
        buildPaths();

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // 바닥에서 5px 정도 여유를 두고 계산
        const reachedBottom = scrollHeight - scrollTop <= clientHeight + 5;
        setIsAtBottom(reachedBottom);
    };

    // 초기 로딩 시 데이터가 적어 스크롤이 필요 없는 경우 처리
    useEffect(() => {
        if (scrollRef.current) {
            const { scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight <= clientHeight) setIsAtBottom(true);
        }
    }, [collectionInfo]);

    const handleNodeClick = (idx: number) => {
        setSelectedIndex(selectedIndex === idx ? null : idx);
    };

    // 1. 선 좌표 계산 로직 (최적화 버전)
    const buildPaths = useCallback(() => {
        if (!projectRef.current || !wrapRef.current) return;

        const projectRect = projectRef.current.getBoundingClientRect();
        const wrapRect = wrapRef.current.getBoundingClientRect();

        const newPaths = collectionInfo.map((_, idx) => {
            const nodeEl = nodeRefs.current[idx];
            if (!nodeEl) return null;

            const nodeRect = nodeEl.getBoundingClientRect();

            // 프로젝트 우측 변 중앙 (시작점)
            const startX = projectRect.right - wrapRect.left;
            const startY = projectRect.top + projectRect.height / 2 - wrapRect.top;

            // 컬렉션 좌측 변 중앙 (끝점)
            const endX = nodeRect.left - wrapRect.left;
            const endY = nodeRect.top + nodeRect.height / 2 - wrapRect.top;

            // 부드러운 곡선을 위한 제어점
            const controlPointX = startX + (endX - startX) / 2;

            // 베지어 곡선으로 연결
            return `M ${startX} ${startY} C ${controlPointX} ${startY}, ${controlPointX} ${endY}, ${endX} ${endY}`;
        });
        // setPaths(newPaths);
        const cleanPaths = newPaths.filter((path): path is string => path !== null);
        setPaths(cleanPaths);
    }, [collectionInfo]);

    useEffect(() => {
        // 카드가 늘어나는 애니메이션 시간을 고려해 약간의 지연 후 실행
        const timer = setTimeout(() => {
            buildPaths();
        }, 300);
        return () => clearTimeout(timer);
    }, [selectedIndex, buildPaths]);

    useLayoutEffect(() => {
        buildPaths();
        window.addEventListener("resize", buildPaths);
        const ro = new ResizeObserver(buildPaths);
        if (wrapRef.current) ro.observe(wrapRef.current);
        nodeRefs.current.forEach(node => node && ro.observe(node));

        return () => {
            window.removeEventListener("resize", buildPaths);
            ro.disconnect();
        };
    }, [buildPaths, names]);
    // <<<

    // href = { projectInfo && projectInfo.collection_num ?
    //     `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
    //     projectInfo && !projectInfo.collection_num ?
    //         `/project/${projectInfo.id}/collection` :
    //         "#"
    // }

    // >>> 베스트 모델 이름 수정
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editValue, setEditValue] = useState("");

    // 이름 수정 실행 함수
    const handleRename = async (modelId: number) => {
        if (!editValue.trim()) {
            setEditingId(null);
            return;
        }
        try {
            await api.patch(`/api/ai/${modelId}/rename`,
                { model_name: editValue },
                { headers: authHeader(token) }
            );

            // 로컬 상태 업데이트 (화면에 즉시 반영)
            setModels(prev => prev.map(m =>
                m.id === modelId ? { ...m, model_name: editValue } : m
            ));

            setEditingId(null);
        } catch (e) {
            console.error("이름 수정 실패:", e);
            alert("이름 수정 중 오류가 발생했습니다.");
        }
    };
    // <<<

    useEffect(() => {
        if (!project_id || !token) return;

        let cancelled = false;

        async function loadPreview() {
            setLoading(true);
            try {
                const res = await api.get(`/api/project/${project_id}/detail`, {
                    headers: authHeader(token),
                });

                const data = res.data;

                if (!cancelled) {
                    setProjectInfo(data.project_info || null);
                    setModels(data.models || []);
                    setCollectionInfo(data.collection_info || []);
                }
            } catch (e) {
                console.error("데이터 로딩 오류:", e);
            } finally {
                setLoading(false);
            }
        }

        loadPreview();
        return () => {
            cancelled = true;
        };
    }, [project_id, token]);

    return (
        <ProjectLayout
            projectNo={projectInfo?.id}
            projectName={projectInfo?.project_name}
            projectDesc={projectInfo?.project_description}
            taskType={projectInfo?.task_type}
            sourceType={projectInfo?.source_type}
            collectionNum={projectInfo?.collection_num}
            CreatedDatetime={projectInfo?.created_datetime}
            UpdatedDatetime={projectInfo?.updated_datetime}
            isLoading={loading} // 🔴 [핵심 수정] 로딩 상태를 Layout에 전달
        >
            <div className="space-y-6">
                {/* 프로젝트 소스 타입 안내 섹션 */}
                <section className={`relative overflow-hidden rounded-2xl border transition-all p-5 
                    ${projectInfo?.source_type === 'search'
                        ? 'bg-blue-50/50 border-blue-100'
                        : 'bg-emerald-50/50 border-emerald-100'}`}>

                    {/* 배경 장식 (패턴) */}
                    <div className="absolute right-[-20px] top-[-20px] opacity-10">
                        {projectInfo?.source_type === 'search'
                            ? <Database size={120} className="text-blue-600" />
                            : <Plus size={120} className="text-emerald-600" />
                        }
                    </div>

                    <div className="flex items-center gap-5 relative z-10">
                        {/* 아이콘 박스 */}
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-sm
                            ${projectInfo?.source_type === 'search' ? 'bg-blue-600' : 'bg-emerald-600'}`}>
                            {projectInfo?.source_type === 'search'
                                ? <Database className="text-white w-7 h-7" />
                                : <Plus className="text-white w-7 h-7" />
                            }
                        </div>

                        {/* 텍스트 설명 */}
                        <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md
                                    ${projectInfo?.source_type === 'search'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-emerald-100 text-emerald-700'}`}>
                                    {projectInfo?.source_type}
                                </span>
                                <h2 className="text-lg font-bold text-zinc-900">
                                    {projectInfo?.source_type === 'search' ? "데이터베이스 검색 기반" : "파일 업로드 기반"}
                                </h2>
                            </div>
                            <p className="text-sm text-zinc-600">
                                {projectInfo?.source_type === 'search'
                                    ? "글로벌 특허 및 논문 데이터베이스를 직접 조회하여 구성된 프로젝트입니다."
                                    : "사용자가 직접 업로드한 로컬 문서 파일을 기반으로 구성된 프로젝트입니다."}
                            </p>
                        </div>

                        {/* 상태 표시 뱃지 */}
                        <div className="hidden md:block text-right">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Active Status</p>
                            <div className="flex items-center gap-1.5 justify-end">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm font-semibold text-zinc-700 font-mono">LIVE_STREAMING</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* >>> 프로젝트 구조 도형 노드 - 좌우 레이아웃 */}
                {collectionInfo.length === 0 ? (
                    // 빈 상태 디자인
                    <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-200 rounded-3xl bg-zinc-50/30">
                        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mb-4">
                            <Plus className="w-8 h-8 text-zinc-400" />
                        </div>
                        <p className="text-zinc-500 font-medium">연결된 컬렉션이 없습니다</p>
                        <p className="text-zinc-400 text-sm mb-6">데이터 소스를 추가하여 파이프라인을 구성해보세요.</p>
                        <Link
                            href={projectInfo ? `/project/${projectInfo.id}/collection` : "#"}
                            className="flex items-center gap-2 px-6 py-3 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-700 hover:bg-zinc-50 hover:border-blue-300 hover:text-blue-600 transition-all shadow-sm active:scale-95"
                        >
                            <Plus className="h-4 w-4" />
                            컬렉션 추가하기
                        </Link>
                    </div>
                ) : (
                    <div ref={wrapRef} className="mb-16 p-8 bg-zinc-50/50 rounded-3xl border border-zinc-100 relative overflow-hidden">
                        <h3 className="text-sm font-semibold text-zinc-400 mb-8 flex items-center gap-2 relative z-20">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            분류 파이프라인 구조
                        </h3>

                        {/* SVG - 좌우 연결선 */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 overflow-visible">
                            {paths.map((d, idx) => {
                                if (!d) return null;

                                // 🚀 수정: hoverIndex 대신 selectedIndex를 사용합니다.
                                const isActive = selectedIndex === idx;
                                const isAnySelected = selectedIndex !== null;
                                const isDimmed = isAnySelected && !isActive;

                                return (
                                    <path
                                        key={idx}
                                        d={d}
                                        fill="none"
                                        /* 🚀 활성화 시 파란색, 비활성 시 회색 */
                                        stroke={isActive ? "#2563eb" : "#C7CAD1"}
                                        /* 🚀 활성화 시 선을 더 굵게 */
                                        strokeWidth={isActive ? 3 : 0.8}
                                        strokeLinecap="round"
                                        /* 🚀 isActive일 때만 점선 효과(Dasharray) 적용 */
                                        strokeDasharray={isActive ? "8, 5" : "0"}
                                        className="transition-all duration-500 ease-in-out"
                                        style={{
                                            opacity: isDimmed ? 0.15 : 1,
                                            /* 점선이 흐르는 애니메이션 추가 (선택 사항) */
                                            animation: isActive ? "flow 20s linear infinite" : "none"
                                        }}
                                    />
                                );
                            })}
                        </svg>

                        {/* 좌우 레이아웃 */}
                        <div className="flex items-start gap-12 relative z-20">
                            {/* 왼쪽: 프로젝트 노드 (세로 길다란 직사각형 - 224px) */}
                            <div className="flex-shrink-0">
                                <div
                                    ref={projectRef}
                                    // 프로젝트 도형 크기 조절
                                    className="bg-white border-2 border-blue-600 w-40 h-[300px] rounded-lg shadow-xl shadow-blue-100 flex flex-col items-center justify-center px-4"
                                >
                                    <div className="flex flex-col items-center justify-center h-full w-full">
                                        {/* 상단 라벨 */}
                                        {/* <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] mt-4">
                                            기술 분류 모델
                                        </span> */}

                                        {/* 중앙 그룹: 모델 이름 및 컬렉션 수 */}
                                        <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full">
                                            {/* <span className="text-base font-extrabold text-zinc-900 text-center leading-tight">
                                                기술 분류 모델
                                            </span> */}
                                            <span className="text-[12px] font-black uppercase tracking-[0.2em] mt-4">
                                                기술 분류 모델
                                            </span>
                                            <div className="flex flex-col items-center bg-blue-50/50 w-full py-4 rounded-xl border border-blue-100/50">
                                                <span className="text-[12px] font-bold text-zinc-400 uppercase tracking-tighter mt-1">
                                                    클래스
                                                </span>
                                                <span className="text-3xl font-black text-blue-600">
                                                    {projectInfo?.collection_num || 0}<small>개</small>
                                                </span>
                                            </div>
                                        </div>

                                        {/* 하단 장식 */}
                                        <div className="mt-3 w-10 h-1 bg-blue-600 rounded-full opacity-50"></div>
                                    </div>
                                </div>
                            </div>

                            {/* 오른쪽: 컬렉션 노드들 (세로 스크롤 - 280px) */}
                            {/* 오른쪽: 컬렉션 노드들 영역 */}
                            <div className="flex-1 relative"> {/* 화살표 배치를 위해 relative 추가 */}
                                <div
                                    ref={scrollRef}
                                    onScroll={handleScroll}
                                    /* 🚀 4개 노드 정도 보이도록 높이 조절 (노드당 약 110px 계산) */
                                    className="max-h-[300px] overflow-y-auto pr-4 scrollbar-hide transition-all duration-300"
                                    style={{
                                        /* 🚀 바닥에 도달하면 마스크(투명효과) 제거 */
                                        maskImage: isAtBottom
                                            ? 'none'
                                            : 'linear-gradient(to bottom, black 80%, transparent 100%)',
                                        WebkitMaskImage: isAtBottom
                                            ? 'none'
                                            : 'linear-gradient(to bottom, black 80%, transparent 100%)'
                                    }}
                                >
                                    <div className="flex flex-col gap-4 relative z-30 pb-10">
                                        {collectionInfo.map((collection, idx) => {
                                            const isSelected = selectedIndex === idx;
                                            return (
                                                <div
                                                    key={collection.id || idx}
                                                    // ref={(el) => (nodeRefs.current[idx] = el)}
                                                    ref={(el) => { nodeRefs.current[idx] = el; }}
                                                    onClick={() => handleNodeClick(idx)}
                                                    className={`transition-all duration-300 cursor-pointer origin-left
                            ${selectedIndex !== null && !isSelected ? "opacity-40" : "opacity-100"}`}
                                                >
                                                    {/* 컬렉션 도형 디자인 (기존 호버/선택 로직 유지) */}
                                                    <div className={`bg-white border-2 rounded-2xl shadow-sm transition-all duration-300
                            hover:bg-zinc-50 hover:border-zinc-300
                            ${isSelected ? "border-blue-500 shadow-md translate-x-4 bg-blue-50/20" : "border-zinc-200"}`}
                                                    >
                                                        {/* ... 카드 내부 콘텐츠 (기존과 동일) ... */}
                                                        <div className="p-4 flex items-center justify-between gap-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-blue-500" : "bg-zinc-300"}`} />
                                                                <p className={`text-lg font-bold ${isSelected ? "text-blue-600" : "text-zinc-700"}`}>
                                                                    {collection.collection_name || "이름 없음"}
                                                                </p>
                                                            </div>
                                                            {isSelected ? <ChevronUp size={18} className="text-blue-500" /> : <ChevronDown size={18} className="text-zinc-400" />}
                                                        </div>

                                                        {/* 상세 정보 (비율 Bar 포함 섹션) */}
                                                        {isSelected && (
                                                            <div className={`transition-all duration-500 ease-in-out bg-white/50
                                                                ${isSelected ? "max-h-[300px] opacity-100 border-t border-zinc-100 p-5" : "max-h-0 opacity-0 overflow-hidden"}`}
                                                            >
                                                                <div className="grid grid-cols-2 gap-4">

                                                                    <div className="col-span-2 pt-2 flex justify-start">
                                                                        <button
                                                                            className="text-[15px] font-bold text-zinc-400 hover:text-blue-600 flex items-center gap-1 transition-colors"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation(); // 카드 닫힘 방지
                                                                                router.push(`/project/${projectInfo?.id}/collection/${collection.id}`);
                                                                            }}
                                                                        >
                                                                            상세 보기 <ChevronRight size={14} />
                                                                        </button>
                                                                    </div>

                                                                    <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm">
                                                                        <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Total Records</p>
                                                                        <p className="text-xl font-black text-zinc-800">
                                                                            {(collection.collection_data_num ?? 0).toLocaleString()}
                                                                        </p>
                                                                    </div>
                                                                    <div className="bg-white p-3 rounded-xl border border-zinc-100 shadow-sm flex flex-col justify-center">
                                                                        <div className="flex justify-between items-end mb-2">
                                                                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Contribution</p>
                                                                            {/* 🚀 백분율 수치 표시 */}
                                                                            <span className="text-xs font-black text-blue-600">
                                                                                {((collection.collection_data_ratio ?? 0) * 100).toFixed(1)}%
                                                                            </span>
                                                                        </div>

                                                                        {/* 🚀 실시간 비율 Bar */}
                                                                        <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                                                                            <div
                                                                                className="h-full bg-blue-500 rounded-full transition-all duration-1000 ease-out"
                                                                                style={{
                                                                                    /* 카드가 열릴 때 Bar가 차오르는 애니메이션을 위해 style로 폭 조절 */
                                                                                    width: isSelected ? `${(collection.collection_data_ratio ?? 0) * 100}%` : '0%'
                                                                                }}
                                                                            />
                                                                        </div>
                                                                    </div>

                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 🚀 아래에 더 있다는 것을 알려주는 화살표 표시 */}
                                {!isAtBottom && collectionInfo.length > 4 && (
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center animate-bounce text-blue-500">
                                        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full shadow-sm border border-blue-100 mb-1">
                                            MORE
                                        </span>
                                        <ChevronDown size={20} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <style jsx>{`
                            .scrollbar-hide::-webkit-scrollbar { display: none; }
                            .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                        `}</style>
                        <style jsx>{`
                            @keyframes flow {
                                from { stroke-dashoffset: 1000; }
                                to { stroke-dashoffset: 0; }
                            }
                        `}</style>
                    </div>
                )}
                {/* <<< */}

                {/* 프로젝트 개요 */}
                {/* <section className="bg-white rounded-lg border border-zinc-200 p-6">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">프로젝트 개요</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Calendar className="h-4 w-4" />
                            <span>생성일: {projectInfo?.created_datetime ? setDatetimeToDate(projectInfo.created_datetime) : '정보 없음'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-zinc-600">
                            <Calendar className="h-4 w-4" />
                            <span>수정일: {projectInfo?.updated_datetime ? setDatetimeToDate(projectInfo.updated_datetime) : '정보 없음'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                {projectData.status}
                            </span>
                        </div>
                    </div>
                </section> */}

                {/* 통계 카드 */}
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">클래스 갯수</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.collection_num ?? '-'}
                                    <span className="text-lg text-zinc-600">개</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Database className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">총 데이터</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.labeled_documents ?? '0'}
                                    <span className="text-lg text-zinc-600">개</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                <Database className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">학습된 모델</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.model_count ?? '0'}
                                    <span className="text-lg text-zinc-600">개</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                <Cpu className="h-6 w-6 text-purple-600" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg border border-zinc-200 p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-zinc-600">평균 정확도</p>
                                <p className="text-3xl font-bold text-zinc-900 mt-1">
                                    {projectInfo?.mean_score != null ? projectInfo.mean_score.toFixed(2) : '-'}
                                    <span className="text-lg text-zinc-600">%</span>
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* 베스트 모델 섹션 */}
                <section className="bg-white rounded-lg border border-zinc-200 p-6">
                    <h2 className="text-lg font-semibold text-zinc-900 mb-4">베스트 모델</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {models.length > 0 ? models.slice(0, 3).map((model) => {
                            const isTraining = !model.accuracy;
                            const isClassification = model.task_type === 'classification';

                            return (
                                <Link
                                    key={model.id}
                                    href={model.task_type === 'classification' ? `/project/${project_id}/models/${model.id}` : '#'}
                                    className="border border-zinc-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all group relative bg-white"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex-grow min-w-0 mr-2">
                                            {editingId === model.id ? (
                                                /* 편집 모드: 입력창 + 확인/취소 버튼 */
                                                <div className="flex items-center gap-2 w-full">
                                                    <input
                                                        autoFocus
                                                        className="text-sm font-semibold text-zinc-900 border-b-2 border-blue-500 outline-none flex-grow bg-transparent"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRename(model.id);
                                                            if (e.key === 'Escape') setEditingId(null);
                                                        }}
                                                    />
                                                    <button onClick={() => handleRename(model.id)} className="text-blue-600 hover:text-blue-800">
                                                        <Check size={14} />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600">
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                /* 일반 모드: 이름 + 연필 아이콘 */
                                                <div
                                                    className="flex items-center gap-1.5 cursor-pointer group/name inline-flex max-w-full"
                                                    onClick={() => {
                                                        setEditingId(model.id);
                                                        setEditValue(model.model_name);
                                                    }}
                                                >
                                                    <h3 className="font-semibold text-zinc-900 truncate group-hover/name:text-blue-600 transition-colors">
                                                        {model.model_name}
                                                    </h3>
                                                    {/* 얇고 작은 연필 아이콘: 평소엔 연하게, 카드 호버 시 진하게 */}
                                                    <Pencil
                                                        size={12}
                                                        className="text-zinc-400 opacity-40 group-hover:opacity-100 group-hover/name:text-blue-600 transition-all flex-shrink-0"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        <span className="px-2 py-0.5 bg-green-50 text-green-600 border border-green-100 rounded text-[11px] font-bold whitespace-nowrap">
                                            {model.status || '완료'}
                                        </span>
                                    </div>

                                    {/* 하단 정보 영역 (기존 유지) */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="text-[11px] text-zinc-500 font-medium px-1.5 py-0.5 bg-zinc-100 rounded">{model?.task_type === "classification" ? "분류 모델" : "추천 모델"}</span>
                                        <span className="text-[11px] text-zinc-400">
                                            {model?.updated_datetime && setDatetimeToDate(model.updated_datetime)}
                                        </span>
                                    </div>

                                    {/* 프로그레스 바 영역 */}
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-zinc-500">정확도</span>
                                            {/* <span className="font-bold text-blue-600">{(model.accuracy * 100).toFixed(2)}%</span> */}
                                            {isTraining ? (
                                                <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                                                    <Loader2 size={12} className="animate-spin" />
                                                    <span>학습 중...</span>
                                                </div>
                                            ) : (
                                                <span className="font-bold text-blue-600">
                                                    {/* {(model.accuracy * 100).toFixed(2)}% */}
                                                    {((model.accuracy ?? 0) * 100).toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                        <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden">
                                            {/* <div
                                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-700"
                                                style={{ width: `${model.accuracy * 100}%` }}
                                            /> */}
                                            <div
                                                className={`h-1.5 rounded-full transition-all duration-700 ${isTraining
                                                    ? 'bg-amber-400 animate-pulse' // 학습 중일 때는 깜빡이는 애니메이션
                                                    : 'bg-blue-600'
                                                    }`}
                                                style={{
                                                    // width: isTraining ? '100%' : `${(model.accuracy * 100)}%`
                                                    width: isTraining ? '100%' : `${((model.accuracy ?? 0) * 100)}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </Link>
                            );
                        }) : (
                            <div className="text-zinc-500 col-span-3 py-10 text-center bg-zinc-50 rounded-lg border border-dashed border-zinc-200">
                                아직 학습된 모델이 없습니다.
                            </div>
                        )}
                    </div>
                </section>

                {/* 최근 활동 & 빠른 작업 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 최근 활동 더미*/}
                    <section className="bg-white rounded-lg border border-zinc-200 p-6">
                        <h2 className="text-lg font-semibold text-zinc-900 mb-4">최근 활동(Dummy)</h2>
                        <div className="space-y-3">
                            {projectData.recentActivities.map((activity, index) => (
                                <div key={index} className="flex items-start gap-3">
                                    <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                                    <div className="flex-grow">
                                        <p className="text-sm text-zinc-900">{activity.action}</p>
                                        <p className="text-xs text-zinc-500">{activity.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* 빠른 작업 */}
                    <section className="bg-white rounded-lg border border-zinc-200 p-6">
                        <h2 className="text-lg font-semibold text-zinc-900 mb-4">빠른 작업</h2>
                        <div className="space-y-3">
                            <Link
                                // projectInfo가 있을 때만 유효한 href 설정
                                // href={projectInfo ? `/project/${projectInfo.id}/data/${projectInfo.source_type?.toLowerCase()}` : "#"}
                                href={projectInfo ? `/project/${projectInfo.id}/collection` : "#"}
                                className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                        <Plus className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900">분류 컬렉션 관리</p>
                                        <p className="text-sm text-zinc-600">컬렉션을 관리합니다</p>
                                    </div>
                                </div>
                                <Zap className="h-5 w-5 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                            </Link>

                            <Link
                                // projectInfo가 있을 때만 유효한 href 설정
                                // href={projectInfo && projectInfo.collection_num && projectInfo.labeled_documents ?
                                //     `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                //     projectInfo && !projectInfo.collection_num && !projectInfo.labeled_documents ?
                                //         `/project/${projectInfo.id}/collection` :
                                //         projectInfo && projectInfo.collection_num && !projectInfo.labeled_documents ?
                                //             `/project/${projectInfo.id}/models/${projectInfo.source_type}` :
                                //             "#"}

                                // >>> 2026-01-08 temporary modified
                                // 컬렉션 관리를 임시로 제거하고 첫 모델 학습시에도 바로 학습 페이지로 이동
                                // 검색 또는 업로드 결과에 대한 학습만 진행하도록 수정
                                // href={projectInfo && projectInfo.collection_num ?
                                //     `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                //     projectInfo && !projectInfo.collection_num ?
                                //         `/project/${projectInfo.id}/collection` :
                                //         "#"}

                                // href={projectInfo && projectInfo.collection_num ?
                                //     `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                //     projectInfo && !projectInfo.collection_num ?
                                //         `/project/${projectInfo.id}/collection` :
                                //         "#"}

                                href={projectInfo ?
                                    `/project/${projectInfo.id}/models/new?collection_num=${projectInfo.collection_num}&task_type=${projectInfo.task_type}&source_type=${projectInfo.source_type}` :
                                    "#"}
                                className="w-full flex items-center justify-between p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                                        <Cpu className="h-5 w-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-zinc-900">새 모델 생성</p>
                                        <p className="text-sm text-zinc-600">
                                            새로운 AI 모델을 학습시킵니다
                                        </p>
                                    </div>
                                </div>
                                <Zap className="h-5 w-5 text-zinc-400 group-hover:text-purple-600 transition-colors" />
                            </Link>
                        </div>
                    </section>
                </div>

            </div>
        </ProjectLayout >
    );
}