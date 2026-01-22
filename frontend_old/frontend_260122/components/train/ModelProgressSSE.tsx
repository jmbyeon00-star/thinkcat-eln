// components/ModelProgressSSE.tsx
import { taskMapper } from "@/types/ai";
import { useEffect, useState } from "react";

interface ModelProgressSSEProps {
    targetId: number;
    initialProgress?: number;
    task_type?: string;
    model_status?: string;
    setValue?: (value: number) => void; // 외부에서 전달받을 수도 있음
    setStatus?: (value: string) => void; // 외부에서 전달받을 수도 있음
}

export default function ModelProgressSSE({
    targetId,
    initialProgress = 0,
    task_type = "",
    model_status = "",
    setValue, // 선택적 props
    setStatus,
}: ModelProgressSSEProps) {
    const [progress, setProgress] = useState(initialProgress);

    useEffect(() => {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
        const es = new EventSource(`${API_BASE}/api/status/progress/stream/${targetId}`);
        es.onmessage = (e) => {
            const data = JSON.parse(e.data);

            setProgress(Number(data.progress));
            setValue?.(Number(data.progress));
            setStatus?.(data.status);
        };

        es.onerror = (err) => {
            console.error("SSE error:", err);
            es.close();
            setTimeout(() => {
                const retry = new EventSource(`${API_BASE}/api/status/progress/stream/${targetId}`);
                // 같은 로직 다시 연결
                retry.onmessage = es.onmessage;
                retry.onerror = es.onerror;
            }, 1000);
        };

        return () => es.close();
    }, [targetId]);

    return (
        <div className="mt-4">
            {progress === -1 ?
                <>

                </>
                :
                <>
                    <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
                        <span>{taskMapper[task_type] ?? task_type}</span>
                        <span className="font-semibold">{progress}%</span>
                    </div>
                    <div className="relative w-full bg-zinc-200 rounded-full h-2">
                        <div
                            className={`h-2 rounded-full transition-all duration-500 ${progress === 100 ? "bg-emerald-500" : model_status === "FAILED" ? "bg-red-500" : "bg-blue-500"
                                }`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </>
            }
        </div>
    );
}
