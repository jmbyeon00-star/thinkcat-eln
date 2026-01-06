import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState } from "react";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { FileText, Save, ArrowLeft, ArrowRight, Loader2, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

import { withMessages } from '@/lib/i18n/withMessages';
export const getServerSideProps = withMessages();

type PreviewItem = {
    pdid: number;
    application_number: string;
    title: string;
    abstract?: string;
    collection_name?: string;
};

export default function ProjectPreviewPage() {
    const router = useRouter();
    const { project_id } = router.query;
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<PreviewItem[]>([]);
    const [types, setTypes] = useState<{ source_type: string; task_type: string, project_code: string, project_name: string } | null>(null);
    const [editingCell, setEditingCell] = useState<{ row: number; key: keyof PreviewItem } | null>(null);
    const [modified, setModified] = useState<Record<string, Partial<PreviewItem>>>({});
    const [expandedRow, setExpandedRow] = useState<number | null>(null); // 단일 행만 확장
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    const pagedItems = items.slice((page - 1) * perPage, page * perPage);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [items, perPage, totalPages, page]);

    useEffect(() => {
        if (!project_id) return;
        async function loadPreview() {
            try {
                const res = await fetch(`${API_BASE}/api/project/${project_id}/preview`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) throw new Error("불러오기 실패");
                const data = await res.json();
                setItems(data.items || []);
                setTypes(data.types || null);

            } catch (e) {
                alert("미리보기 데이터를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        loadPreview();
    }, [project_id]);

    const handleChange = (row: number, key: keyof PreviewItem, value: string) => {
        const pdid = items[row].pdid;
        // const appNum = items[row].application_number;
        setItems((prev) => prev.map((item, idx) => idx === row ? { ...item, [key]: value } : item));
        // setModified((prev) => ({ ...prev, [appNum]: { ...prev[appNum], [key]: value } }));
        setModified((prev) => ({ ...prev, [pdid]: { ...prev[pdid], [key]: value } }));
    };

    const handleSave = async () => {
        const updates = Object.entries(modified).map(([pdid, fields]) => ({
            pdid: pdid,
            ...fields,
        }));

        if (updates.length === 0) {
            alert("변경된 데이터가 없습니다.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/project/${project_id}/data/update`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: updates }),
            });
            if (!res.ok) throw new Error("업데이트 실패");
            alert("저장 완료!");
            setModified({});
        } catch (err) {
            alert("저장 실패");
            console.error(err);
        }
    };

    const toggleExpandRow = (index: number) => {
        setExpandedRow((prev) => prev === index ? null : index);
    };

    const truncateText = (text: string | undefined, maxLength: number) => {
        if (!text) return "";
        return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
    };

    if (loading) {
        return (
            <ProjectLayout>
                <div className="flex min-h-screen items-center justify-center bg-white">
                    <div className="flex items-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-zinc-600">불러오는 중...</span>
                    </div>
                </div>
            </ProjectLayout>
        );
    }

    return (
        <ProjectLayout projectNo={Number(project_id)} sourceType={types?.source_type} >
            {/* <ProjectLayout 
            projectNo={projectInfo?.id}
            projectName={projectInfo?.project_name}
            projectDesc={projectInfo?.project_description}
            sourceType={projectInfo?.source_type}
        > */}
            <Head>
                <title>프로젝트 #{project_id} | 미리보기 | IPFORCE</title>
            </Head>
            <div className="min-h-screen bg-white p-8">
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-1 h-8 bg-gradient-to-b from-blue-700 to-blue-900 rounded-full" />
                        <h1 className="text-3xl font-bold text-zinc-900">파일 편집</h1>
                    </div>
                    <p className="text-zinc-600 ml-4">
                        업로드 한 데이터를 검토 및 수정할 수 있습니다.
                    </p>
                </div>
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Main Card */}
                    <div className="bg-white rounded-2xl shadow-xl border border-zinc-100 overflow-hidden">
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <FileText className="w-6 h-6 text-white" />
                                    <h2 className="text-xl font-semibold text-white">등록된 특허 미리보기</h2>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="px-4 py-2 bg-white/20 rounded-full text-white font-bold">
                                        {items.length.toLocaleString()}건
                                    </span>
                                    {Object.keys(modified).length > 0 && (
                                        <span className="px-3 py-1 bg-yellow-400 text-yellow-900 rounded-full text-sm font-semibold">
                                            {Object.keys(modified).length}개 수정됨
                                        </span>
                                    )}
                                </div>
                            </div>
                            <p className="text-blue-100 text-sm mt-2">
                                특허 정보를 확인하고 편집할 수 있습니다. 특허명과 요약문을 클릭하여 수정하세요.
                            </p>
                        </div>

                        {/* Table Content */}
                        <div className="p-8">
                            {items.length === 0 ? (
                                <div className="py-20 text-center">
                                    <FileText className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
                                    <p className="text-zinc-500 text-lg">등록된 데이터가 없습니다.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Info Box */}
                                    <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <Edit3 className="w-5 h-5 text-blue-600 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-blue-900 mb-1">편집 안내</p>
                                                <p className="text-xs text-blue-800 leading-relaxed">
                                                    특허명과 요약문을 클릭하면 직접 수정할 수 있습니다.
                                                    "보기" 버튼을 클릭하면 잘린 내용의 전체를 확인할 수 있습니다.
                                                    수정 후 하단의 "저장하기" 버튼을 눌러 변경사항을 저장하세요.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-hidden rounded-xl border-2 border-zinc-200">
                                        <table className="w-full table-fixed">
                                            <thead className="bg-zinc-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700" style={{ width: '60px' }}>#</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700" style={{ width: '140px' }}>출원번호</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700" style={{ width: '30%' }}>특허명</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700" style={{ width: '35%' }}>요약문</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700" style={{ width: '15%' }}>컬렉션</th>
                                                    <th className="px-4 py-3 text-center text-sm font-semibold text-zinc-700" style={{ width: '80px' }}>보기</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedItems.map((r, i) => {
                                                    const globalIndex = (page - 1) * perPage + i;
                                                    const isModified = modified[r.application_number];
                                                    const isExpanded = expandedRow === globalIndex;
                                                    return (
                                                        <>
                                                            <tr
                                                                key={r.application_number}
                                                                className={`border-t border-zinc-200 hover:bg-blue-50 transition-colors ${isModified ? 'bg-yellow-50' : ''}`}
                                                            >
                                                                <td className="px-4 py-3 text-sm text-zinc-600">
                                                                    {globalIndex + 1}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm font-mono text-zinc-900">
                                                                    {r.application_number}
                                                                </td>
                                                                <td
                                                                    className="px-4 py-3 text-sm cursor-pointer group relative"
                                                                    onClick={() => !isExpanded && setEditingCell({ row: globalIndex, key: "title" })}
                                                                >
                                                                    {editingCell?.row === globalIndex && editingCell.key === "title" && !isExpanded ? (
                                                                        <input
                                                                            className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                            value={r.title}
                                                                            onChange={(e) => handleChange(globalIndex, "title", e.target.value)}
                                                                            onBlur={() => setEditingCell(null)}
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="flex-1 truncate">{truncateText(r.title, 50)}</span>
                                                                            {!isExpanded && (
                                                                                <Edit3 className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td
                                                                    className="px-4 py-3 text-sm cursor-pointer group relative"
                                                                    onClick={() => !isExpanded && setEditingCell({ row: globalIndex, key: "abstract" })}
                                                                >
                                                                    {editingCell?.row === globalIndex && editingCell.key === "abstract" && !isExpanded ? (
                                                                        <textarea
                                                                            className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                            value={r.abstract || ""}
                                                                            onChange={(e) => handleChange(globalIndex, "abstract", e.target.value)}
                                                                            onBlur={() => setEditingCell(null)}
                                                                            autoFocus
                                                                            rows={3}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="flex-1 text-zinc-600 truncate">
                                                                                {truncateText(r.abstract, 80) || "요약문 없음"}
                                                                            </span>
                                                                            {!isExpanded && (
                                                                                <Edit3 className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </td>
                                                                <td className="px-4 py-3 text-sm">
                                                                    <span className={`truncate block ${r.collection_name ? 'text-blue-600 font-medium' : 'text-zinc-400'}`}>
                                                                        {truncateText(r.collection_name, 20) || "미지정"}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <button
                                                                        onClick={() => toggleExpandRow(globalIndex)}
                                                                        className="text-blue-600 hover:text-blue-800 transition-colors p-1 inline-flex items-center justify-center"
                                                                    >
                                                                        {isExpanded ? (
                                                                            <ChevronUp className="w-5 h-5" />
                                                                        ) : (
                                                                            <ChevronDown className="w-5 h-5" />
                                                                        )}
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && (
                                                                <tr className="bg-blue-50 border-t border-zinc-200">
                                                                    <td colSpan={6} className="px-4 py-4">
                                                                        <div className="space-y-3 text-sm">
                                                                            <div>
                                                                                <strong className="text-zinc-700 block mb-1">특허명 (전체):</strong>
                                                                                <p className="ml-2 text-zinc-900 leading-relaxed">{r.title}</p>
                                                                            </div>
                                                                            <div>
                                                                                <strong className="text-zinc-700 block mb-1">요약문 (전체):</strong>
                                                                                <p className="ml-2 text-zinc-600 leading-relaxed whitespace-pre-wrap">
                                                                                    {r.abstract || "요약문이 없습니다."}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <strong className="text-zinc-700 block mb-1">컬렉션명:</strong>
                                                                                <p className="ml-2 text-zinc-600 leading-relaxed whitespace-pre-wrap">
                                                                                    {r.collection_name}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </>
                                                    );
                                                })}
                                            </tbody>
                                        </table>

                                        {/* Pagination Footer */}
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-zinc-200 bg-zinc-50">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setPage(1)} disabled={page === 1} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-white transition-all text-sm font-medium">«</button>
                                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-white transition-all text-sm font-medium">이전</button>
                                                <span className="px-4 py-2 text-sm text-zinc-700 font-medium">
                                                    <span className="text-blue-600 font-bold">{page}</span> / {totalPages}
                                                </span>
                                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-white transition-all text-sm font-medium">다음</button>
                                                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-3 py-2 border-2 border-zinc-200 rounded-lg disabled:opacity-50 hover:bg-white transition-all text-sm font-medium">»</button>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className="text-sm text-zinc-600">행 개수</span>
                                                <select
                                                    value={perPage}
                                                    onChange={(e) => {
                                                        setPerPage(parseInt(e.target.value, 10));
                                                        setPage(1);
                                                    }}
                                                    className="px-3 py-2 border-2 border-zinc-200 rounded-lg text-sm font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                                                >
                                                    {[10, 20, 50, 100].map((n) => (
                                                        <option key={n} value={n}>{n}/페이지</option>
                                                    ))}
                                                </select>
                                                <span className="text-xs text-zinc-500 font-medium">총 {items.length.toLocaleString()}건</span>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                        <button
                            onClick={() => router.push(`/project/search/${project_id}`)}
                            className="px-6 py-3 bg-zinc-200 text-zinc-700 rounded-xl hover:bg-zinc-300 font-medium transition-all flex items-center gap-2"
                        >
                            <ArrowLeft size={18} />
                            이전 단계
                        </button>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={Object.keys(modified).length === 0}
                                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 disabled:from-zinc-300 disabled:to-zinc-400 transition-all flex items-center gap-2"
                            >
                                <Save size={18} />
                                저장하기 {Object.keys(modified).length > 0 && `(${Object.keys(modified).length})`}
                            </button>
                            <button
                                onClick={() => router.push(`/project/stats/${project_id}`)}
                                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center gap-2"
                            >
                                다음
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProjectLayout >
    );
}