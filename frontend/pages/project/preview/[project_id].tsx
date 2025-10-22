import { useRouter } from "next/router";
import Head from "next/head";
import { useEffect, useState } from "react";
import ProjectLayout from "@/components/layouts/ProjectLayout";
import { FileText, Save, ArrowLeft, ArrowRight, Loader2, Edit3 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Session } from "next-auth";

type PreviewItem = {
    application_number: string;
    title: string;
    abstract?: string;
    collection_name?: string;
};

export default function ProjectPreviewPage() {
    const router = useRouter();
    const { project_id } = router.query;
    const API_BASE = "http://192.168.1.20:8000";

    const { data: session, status } = useSession() as {
        data: (Session & { access_token?: string }) | null;
        status: "loading" | "authenticated" | "unauthenticated";
    };
    const token = session?.access_token;

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<PreviewItem[]>([]);
    const [editingCell, setEditingCell] = useState<{ row: number; key: keyof PreviewItem } | null>(null);
    const [modified, setModified] = useState<Record<string, Partial<PreviewItem>>>({});
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
            } catch (e) {
                alert("미리보기 데이터를 불러오지 못했습니다.");
            } finally {
                setLoading(false);
            }
        }
        loadPreview();
    }, [project_id]);

    const handleChange = (row: number, key: keyof PreviewItem, value: string) => {
        const appNum = items[row].application_number;
        setItems((prev) => prev.map((item, idx) => idx === row ? { ...item, [key]: value } : item));
        setModified((prev) => ({ ...prev, [appNum]: { ...prev[appNum], [key]: value } }));
    };

    const handleSave = async () => {
        const updates = Object.entries(modified).map(([appNum, fields]) => ({
            application_number: appNum,
            ...fields,
        }));

        if (updates.length === 0) {
            alert("변경된 데이터가 없습니다.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/api/project/${project_id}/update`, {
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

    if (loading) {
        return (
            <ProjectLayout step={3}>
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
        <ProjectLayout step={3}>
            <Head>
                <title>프로젝트 #{project_id} | 미리보기 | IPFORCE</title>
            </Head>

            <div className="min-h-screen bg-white p-8">
                <div className="max-w-6xl mx-auto space-y-6">
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
                                특허 정보를 확인하고 편집할 수 있습니다. 셀을 클릭하여 수정하세요.
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
                                                    특허명과 라벨을 클릭하면 직접 수정할 수 있습니다.
                                                    수정 후 하단의 "저장하기" 버튼을 눌러 변경사항을 저장하세요.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="overflow-hidden rounded-xl border-2 border-zinc-200">
                                        <table className="w-full">
                                            <thead className="bg-zinc-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 w-16">#</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 w-1/4">출원번호</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 w-1/2">특허명</th>
                                                    <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-700 w-1/4">라벨</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pagedItems.map((r, i) => {
                                                    const globalIndex = (page - 1) * perPage + i;
                                                    const isModified = modified[r.application_number];
                                                    return (
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
                                                                onClick={() => setEditingCell({ row: globalIndex, key: "title" })}
                                                            >
                                                                {editingCell?.row === globalIndex && editingCell.key === "title" ? (
                                                                    <input
                                                                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                        value={r.title}
                                                                        onChange={(e) => handleChange(globalIndex, "title", e.target.value)}
                                                                        onBlur={() => setEditingCell(null)}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="flex-1">{r.title}</span>
                                                                        <Edit3 className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td
                                                                className="px-4 py-3 text-sm cursor-pointer group relative"
                                                                onClick={() => setEditingCell({ row: globalIndex, key: "collection_name" })}
                                                            >
                                                                {editingCell?.row === globalIndex && editingCell.key === "collection_name" ? (
                                                                    <input
                                                                        className="w-full px-3 py-2 border-2 border-blue-500 rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-blue-100"
                                                                        value={r.collection_name || ""}
                                                                        onChange={(e) => handleChange(globalIndex, "collection_name", e.target.value)}
                                                                        onBlur={() => setEditingCell(null)}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`flex-1 ${r.collection_name ? 'text-blue-600 font-medium' : 'text-zinc-400'}`}>
                                                                            {r.collection_name || "라벨 없음"}
                                                                        </span>
                                                                        <Edit3 className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
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
                                다음 단계
                                <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </ProjectLayout>
    );
}