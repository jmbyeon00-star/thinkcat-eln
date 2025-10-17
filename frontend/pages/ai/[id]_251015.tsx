// pages/ai/[id].tsx
import { useRouter } from "next/router";
import { useEffect, useState, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { ArrowLeft, FileBarChart2, Play, Upload} from "lucide-react";
import Link from "next/link";
import ModelLayout from "@/components/ModelLayout";
import FilePreviewEditor from "@/components/FilePreviewEditor";

type ModelDetail = {
    id: number;
    model_name: string;
    model_desc?: string;
    data_scope: string;
    task_type: string;
    source_type: string;
    collection_num: number;
    progress: number;
    progress_status: "RUNNING" | "COMPLETED" | "FAILED";
    created_datetime?: string;
    metrics?: {
        train_acc?: number[];
        valid_acc?: number[];
        train_loss?: number[];
        valid_loss?: number[];
    };
    mapping?: Record<string, string>;
};

export default function ModelDetailPage() {
    const router = useRouter();
    const { id } = router.query;
    // const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";
    const API_BASE = "http://192.168.1.20:8000"

    const [model, setModel] = useState<ModelDetail | null>(null);
    const [loading, setLoading] = useState(true);

    console.log(model)

    useEffect(() => {
        if (!id) return;
        setLoading(true);
        fetch(`${API_BASE}/api/ai/${id}`, { credentials: "include" })
        .then((res) => res.json())
        .then(setModel)
        .catch((err) => console.error("모델 불러오기 실패:", err))
        .finally(() => setLoading(false));
    }, [id]);

    const lineData = useMemo(() => {
        if (!model?.metrics?.train_acc) return [];
        return model.metrics.train_acc.map((_, i) => ({
        epoch: i + 1,
        train_acc: model.metrics?.train_acc?.[i],
        valid_acc: model.metrics?.valid_acc?.[i],
        train_loss: model.metrics?.train_loss?.[i],
        valid_loss: model.metrics?.valid_loss?.[i],
        }));
    }, [model]);

    console.log(model)
    // 추론 도구
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [inferLoading, setInferLoading] = useState(false);
    const [inferResult, setInferResult] = useState<any>(null);

    const handleInferFile = async () => {
        if (!id || parsedData.length === 0) {
            alert("먼저 파일을 업로드해주세요.");
            return;
        }
    
        const firstRow = parsedData[0];
        const columns = Object.keys(firstRow || {}).map((c) => c.trim().toLowerCase());
    
        if (columns.length === 0) {
            alert("파일에 컬럼이 없습니다. 첫 번째 행에 컬럼명을 포함시켜주세요.");
            return;
        }
    
        // ✅ 1개 컬럼 (문제만 있는 경우)
        if (columns.length === 1) {
            const firstCol = columns[0];
            const validFirst = ["문제", "question", "source"].includes(firstCol);
        
            if (!validFirst) {
                alert(`컬럼명이 올바르지 않습니다.\n\n첫 번째 컬럼은 "문제" 또는 "Question" 또는 "Target" 이어야 합니다.\n\n현재 컬럼: ${firstCol}`);
                return;
            }
        
            // 문제만 있는 경우 → 추론 가능
            console.log("문제만 있는 데이터로 추론 시작");
        }
        
        // ✅ 2개 컬럼 (문제 + 정답)
        else if (columns.length === 2) {
            const [firstCol, secondCol] = columns;
            const validFirst = ["문제", "question", "source"].includes(firstCol);
            const validSecond = ["정답", "answer", "target"].includes(secondCol);
        
            if (!validFirst || !validSecond) {
                alert(
                `컬럼명이 올바르지 않습니다.\n\n` +
                `첫 번째 컬럼: "문제" 또는 "Question" 또는 "Source"\n` +
                `두 번째 컬럼: "정답" 또는 "Answer" 또는 "Target"\n\n` +
                `현재 컬럼: ${columns.join(", ")}`
                );
                return;
            }
        
            console.log("문제 + 정답 데이터로 추론 시작");
        }
    
        // ❌ 3개 이상 → 오류
        else {
            alert(`컬럼이 너무 많습니다. 최대 2개의 컬럼(문제, 정답)만 허용됩니다.\n\n현재 컬럼: ${columns.join(", ")}`);
            return;
        }
    
        // ✅ 모든 검증 통과 시 추론 진행
        setInferLoading(true);
        setInferResult(null);
        
        try {
            const res = await fetch(`${API_BASE}/api/ai/infer/classification/${model?.data_scope}/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ 
                    data: parsedData, 
                    collection_num: model?.collection_num,
                    source_type: model?.source_type, 
                    task_type: model?.task_type 
                }),
            });
            const data = await res.json();
            setInferResult(data);
        } catch (err) {
            setInferResult({ error: "추론 요청 중 오류가 발생했습니다." });
        } finally {
            setInferLoading(false);
            router.push(`/file`);
        }
    };
      



    if (loading)
        return (
        <div className="flex min-h-[70vh] items-center justify-center text-zinc-500">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
            <span className="ml-2">불러오는 중...</span>
        </div>
        );

    if (!model)
        return (
        <div className="text-center text-red-600 mt-10">
            모델 정보를 불러오지 못했습니다.
        </div>
        );

    return (
        <ModelLayout step={4}>
            <div className="p-6 space-y-6">
                {/* 상단 헤더 */}
                <div className="flex items-center justify-between">
                <Link
                    href="/ai"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                    <ArrowLeft className="h-4 w-4" /> 목록으로
                </Link>
                <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    model.progress_status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : model.progress_status === "FAILED"
                        ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                >
                    {model.progress_status === "COMPLETED"
                    ? "학습 완료"
                    : model.progress_status === "FAILED"
                    ? "학습 실패"
                    : "학습 중"}
                </span>
                </div>

                <div>
                <h1 className="text-2xl font-bold">{model.model_name}</h1>
                <p className="text-zinc-600 mt-1">
                    {model.model_desc || "설명 없음"}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                    생성일:{" "}
                    {model.created_datetime
                    ? new Date(model.created_datetime).toLocaleString()
                    : "-"}
                </p>
                </div>

                {/* 클래스 매핑 */}
                {model.mapping && (
                <div className="rounded-xl border bg-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                    <FileBarChart2 className="h-5 w-5 text-zinc-700" />
                    <h2 className="text-lg font-semibold">클래스 매핑</h2>
                    </div>
                    <ul className="text-sm text-zinc-700 list-disc list-inside">
                    {Object.entries(model.mapping).map(([k, v]) => (
                        <li key={k}>
                        {k}: {v}
                        </li>
                    ))}
                    </ul>
                </div>
                )}

                {/* 학습 결과 그래프 */}
                {lineData.length > 0 && (
                <div className="rounded-xl border bg-white p-4">
                    <h2 className="text-lg font-semibold mb-2">학습 결과</h2>
                    <div className="h-72">
                    <ResponsiveContainer>
                        <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="train_acc"
                            stroke="#2563eb"
                            name="Train Acc"
                        />
                        <Line
                            type="monotone"
                            dataKey="valid_acc"
                            stroke="#16a34a"
                            name="Valid Acc"
                        />
                        <Line
                            type="monotone"
                            dataKey="train_loss"
                            stroke="#f97316"
                            name="Train Loss"
                        />
                        <Line
                            type="monotone"
                            dataKey="valid_loss"
                            stroke="#dc2626"
                            name="Valid Loss"
                        />
                        </LineChart>
                    </ResponsiveContainer>
                    </div>
                </div>
                )}
            </div>
            <div className="rounded-xl border bg-white p-4 space-y-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                    <Upload className="h-5 w-5 text-zinc-700" />
                    <h2 className="text-lg font-semibold">파일 기반 모델 추론</h2>
                </div>
                
                {/* 📘 안내 문구 */}
                <div className="flex items-start gap-2 text-sm text-zinc-600 bg-zinc-50 p-3 rounded-lg border">
                    <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 mt-[2px] text-blue-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 18a9 9 0 100-18 9 9 0 000 18z" />
                    </svg>
                    <p>
                    파일의 <b>첫 번째 행은 반드시 컬럼명(헤더)</b>으로 설정해주세요.
                    <br />
                    예시: <code>문제, 정답</code> 또는 <code>Question, Answer</code> 또는 <code>Source, Target</code>
                    <br />
                    지원 형식: <b>.csv</b>, <b>.json</b>, <b>.xlsx</b>
                    </p>
                </div>

                <FilePreviewEditor onDataParsed={setParsedData} />

                <button
                    onClick={handleInferFile}
                    disabled={parsedData.length === 0 || inferLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-md disabled:opacity-50"
                >
                    {inferLoading ? "분류 중..." : "분류하기"}
                </button>

                {/* {inferResult && (
                    <div className="mt-3 bg-zinc-50 rounded-lg border p-3 text-sm">
                        <h3 className="font-semibold mb-2">결과</h3>
                        <pre className="whitespace-pre-wrap text-zinc-700">
                            {JSON.stringify(inferResult, null, 2)}
                        </pre>
                    </div>
                )} */}
            </div>
            

        </ModelLayout>
    );
}
