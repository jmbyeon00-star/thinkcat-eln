'use client';

import { useState } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

type Result = {
    task_id?: string;
    success?: number;
    contents?: string;
    message?: string;
    error?: string;
};

export default function NoteTestPage() {
    const [taskId, setTaskId] = useState("");
    const [filePath, setFilePath] = useState("");
    const [mode, setMode] = useState<"sync" | "async">("sync");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Result | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        try {
            const res = await fetch("/api/admin/note-extract", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    task_id: taskId,
                    file_path: filePath,
                    mode: mode === "async" ? "async" : "sync",
                }),
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            setResult({ error: String(err) });
        } finally {
            setLoading(false);
        }
    };

    const isSuccess = result && result.success === 1;
    const isError = result && (result.success === 0 || result.error);

    return (
        <div className="max-w-2xl">
            <div className="mb-6">
                <h1 className="text-2xl font-black tracking-tight">노트 추출 테스트</h1>
                <p className="text-zinc-500 text-sm mt-1">GPU 백엔드 PDF 텍스트 추출 엔드포인트를 테스트합니다.</p>
            </div>

            <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Task ID</label>
                    <input
                        type="text"
                        value={taskId}
                        onChange={(e) => setTaskId(e.target.value)}
                        placeholder="예: 76JLBEGMB00008V520"
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">File Path</label>
                    <input
                        type="text"
                        value={filePath}
                        onChange={(e) => setFilePath(e.target.value)}
                        placeholder="예: elnfiles/C260000001/76JLBEGMB00008V520/2026/06/20260602141439273-00001__pdf"
                        required
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-xs text-zinc-600 mt-1">ELN_FILE_BASE_PATH 기준 상대 경로</p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">처리 방식</label>
                    <div className="flex gap-3">
                        {(["sync", "async"] as const).map((m) => (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setMode(m)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${mode === m
                                    ? "bg-blue-600 text-white"
                                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                                    }`}
                            >
                                {m === "sync" ? "동기 (결과 즉시 반환)" : "비동기 (백그라운드)"}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? "처리 중..." : "실행"}
                </button>
            </form>

            {result && (
                <div className={`mt-4 bg-zinc-900 border rounded-2xl p-6 ${isSuccess ? "border-green-700" : isError ? "border-red-700" : "border-zinc-700"}`}>
                    <div className="flex items-center gap-2 mb-4">
                        {isSuccess && <CheckCircle size={18} className="text-green-500" />}
                        {isError && <XCircle size={18} className="text-red-500" />}
                        <span className="font-bold text-sm">
                            {isSuccess ? "성공" : isError ? "실패" : "응답"}
                        </span>
                        {result.task_id !== undefined && (
                            <span className="text-zinc-500 text-sm ml-auto">task_id: {result.task_id}</span>
                        )}
                    </div>

                    {result.message && (
                        <p className="text-sm text-zinc-400 mb-3">{result.message}</p>
                    )}
                    {result.error && (
                        <p className="text-sm text-red-400 mb-3">{result.error}</p>
                    )}

                    {result.contents && (
                        <div>
                            <p className="text-xs text-zinc-600 mb-1">추출된 텍스트</p>
                            <pre className="bg-zinc-800 rounded-lg p-3 text-xs text-zinc-300 whitespace-pre-wrap overflow-auto max-h-64">
                                {result.contents}
                            </pre>
                        </div>
                    )}

                    {!result.contents && mode === "async" && (
                        <p className="text-xs text-zinc-600">비동기 모드: 결과는 DB에 저장됩니다.</p>
                    )}
                </div>
            )}
        </div>
    );
}
