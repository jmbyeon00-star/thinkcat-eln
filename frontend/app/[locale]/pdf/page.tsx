'use client';

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Zap, FlaskConical, Bot, Copy, Check, X, Loader2, ChevronDown } from "lucide-react";

type Method = "marker" | "nougat" | "ollama";

interface ExtractResult {
    method: string;
    model?: string;
    text: string;
    pages: number;
    filename?: string;
}

const METHOD_INFO = {
    marker: {
        label: "Marker-PDF",
        icon: <Zap size={16} />,
        desc: "빠른 Markdown 변환 · 일반 문서에 최적",
        color: "blue",
    },
    nougat: {
        label: "Meta Nougat",
        icon: <FlaskConical size={16} />,
        desc: "수식/LaTeX 지원 · 과학 논문에 최적",
        color: "violet",
    },
    ollama: {
        label: "Ollama Vision",
        icon: <Bot size={16} />,
        desc: "Vision LLM · 복잡한 레이아웃에 강함",
        color: "emerald",
    },
} as const;

const COLOR_MAP = {
    blue:    { border: "border-blue-200",   bg: "bg-blue-50",   text: "text-blue-600",   ring: "ring-blue-200",   active: "bg-blue-600"   },
    violet:  { border: "border-violet-200", bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-200", active: "bg-violet-600" },
    emerald: { border: "border-emerald-200",bg: "bg-emerald-50",text: "text-emerald-600",ring: "ring-emerald-200",active: "bg-emerald-600"},
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default function PdfExtractPage() {
    const [file, setFile] = useState<File | null>(null);
    const [method, setMethod] = useState<Method>("marker");
    const [ollamaModel, setOllamaModel] = useState("gemma4:e4b");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<ExtractResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = (f: File) => {
        if (!f.name.toLowerCase().endsWith(".pdf")) {
            setError("PDF 파일만 업로드 가능합니다.");
            return;
        }
        if (f.size > 50 * 1024 * 1024) {
            setError("파일 크기는 50MB 이하만 가능합니다.");
            return;
        }
        setFile(f);
        setError(null);
        setResult(null);
    };

    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFile(dropped);
    }, []);

    const onDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const onDragLeave = () => setIsDragging(false);

    const handleExtract = async () => {
        if (!file) return;

        setLoading(true);
        setError(null);
        setResult(null);

        const formData = new FormData();
        formData.append("file", file);
        formData.append("method", method);
        if (method === "ollama") {
            formData.append("model", ollamaModel);
        }

        try {
            const res = await fetch(`${API_BASE_URL}/api/pdf/extract`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `서버 오류 (${res.status})`);
            }

            const data: ExtractResult = await res.json();
            setResult(data);
        } catch (e: any) {
            setError(e.message || "추출 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!result?.text) return;
        await navigator.clipboard.writeText(result.text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        setFile(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    return (
        <div className="min-h-screen bg-zinc-50">
            <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">

                {/* 헤더 */}
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tight">PDF 추출</h1>
                    <p className="text-sm text-zinc-400 font-medium">
                        PDF를 업로드하고 추출 방식을 선택하세요. 텍스트, 수식, 표를 자동으로 변환합니다.
                    </p>
                </div>

                {/* 방식 선택 */}
                <div className="grid grid-cols-3 gap-3">
                    {(Object.entries(METHOD_INFO) as [Method, typeof METHOD_INFO[Method]][]).map(([id, info]) => {
                        const c = COLOR_MAP[info.color];
                        const isActive = method === id;
                        return (
                            <button
                                key={id}
                                onClick={() => setMethod(id)}
                                className={`
                                    relative p-4 rounded-2xl border-2 text-left transition-all duration-200
                                    ${isActive
                                        ? `${c.border} ${c.bg} ring-2 ${c.ring} shadow-sm`
                                        : "border-zinc-100 bg-white hover:border-zinc-200 hover:shadow-sm"
                                    }
                                `}
                            >
                                <div className={`flex items-center gap-2 font-black text-sm mb-1 ${isActive ? c.text : "text-zinc-600"}`}>
                                    {info.icon}
                                    {info.label}
                                </div>
                                <p className="text-xs text-zinc-400 leading-relaxed">{info.desc}</p>
                                {isActive && (
                                    <span className={`absolute top-3 right-3 w-2 h-2 rounded-full ${c.active}`} />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Ollama 모델명 입력 */}
                {method === "ollama" && (
                    <div className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-zinc-100 shadow-sm">
                        <Bot size={16} className="text-emerald-500 shrink-0" />
                        <label className="text-sm font-bold text-zinc-600 whitespace-nowrap">모델명</label>
                        <input
                            type="text"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="예: gemma4:e4b"
                            className="flex-1 text-sm font-mono bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-200 transition"
                        />
                    </div>
                )}

                {/* 업로드 영역 */}
                <div
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onClick={() => !file && fileInputRef.current?.click()}
                    className={`
                        relative rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer
                        ${isDragging
                            ? "border-blue-400 bg-blue-50 scale-[1.01]"
                            : file
                                ? "border-zinc-200 bg-white cursor-default"
                                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                        }
                    `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                        }}
                    />

                    {file ? (
                        <div className="flex items-center justify-between p-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                    <FileText size={20} className="text-red-500" />
                                </div>
                                <div>
                                    <p className="font-bold text-zinc-800 text-sm">{file.name}</p>
                                    <p className="text-xs text-zinc-400 mt-0.5">
                                        {(file.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center">
                                <Upload size={24} className="text-zinc-400" />
                            </div>
                            <div className="text-center">
                                <p className="font-bold text-zinc-600 text-sm">
                                    PDF를 드래그하거나 클릭하여 업로드
                                </p>
                                <p className="text-xs text-zinc-400 mt-1">최대 50MB</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* 에러 */}
                {error && (
                    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-600 font-medium">
                        <X size={16} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* 추출 버튼 */}
                <button
                    onClick={handleExtract}
                    disabled={!file || loading}
                    className={`
                        w-full py-4 rounded-2xl font-black text-sm transition-all duration-300 flex items-center justify-center gap-2
                        ${!file || loading
                            ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
                            : "bg-zinc-900 text-white hover:bg-black shadow-lg hover:shadow-xl active:scale-[0.99]"
                        }
                    `}
                >
                    {loading ? (
                        <>
                            <Loader2 size={16} className="animate-spin" />
                            {METHOD_INFO[method].label}로 추출 중...
                        </>
                    ) : (
                        <>
                            {METHOD_INFO[method].icon}
                            {METHOD_INFO[method].label}로 추출하기
                        </>
                    )}
                </button>

                {/* 결과 */}
                {result && (
                    <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                        {/* 결과 헤더 */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-50">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                <span className="font-black text-sm text-zinc-700">추출 완료</span>
                                <span className="text-xs text-zinc-400 font-medium">
                                    {result.pages}페이지 · {result.method.toUpperCase()}
                                    {result.model && ` · ${result.model}`}
                                </span>
                            </div>
                            <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-900 bg-zinc-50 hover:bg-zinc-100 rounded-xl transition"
                            >
                                {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                {copied ? "복사됨" : "복사"}
                            </button>
                        </div>

                        {/* 결과 텍스트 */}
                        <div className="p-6">
                            <pre className="text-sm text-zinc-700 whitespace-pre-wrap font-mono leading-relaxed max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-200">
                                {result.text || "(추출된 내용 없음)"}
                            </pre>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
