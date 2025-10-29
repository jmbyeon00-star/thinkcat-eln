// components/ModelProgressSSE.tsx
"use client";
import { useEffect, useState } from "react";

interface ModelProgressSSEProps {
    targetId: number;
    initialProgress?: number;
    setValue?: (value: number) => void; // 외부에서 전달받을 수도 있음
    setStatus?: (value: string) => void; // 외부에서 전달받을 수도 있음
}

export default function ModelProgressSSE({
    targetId,
    initialProgress = 0,
    setValue, // 선택적 props
    setStatus,
}: ModelProgressSSEProps) {
    const [progress, setProgress] = useState(initialProgress);

    useEffect(() => {
        const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "https://ipforce.co.kr";
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

    const getColorClass = () => {
        if (status === "FAILED") return "bg-red-500";
        if (progress === 100) return "bg-emerald-500";
        return "bg-blue-500";
    };

    const getTextColor = () => {
        if (progress < 50) return "text-zinc-700";
        return "text-white";
    };

    return (
        // <div className="relative w-40 bg-zinc-200 rounded-full h-4">
        // <div className="relative w-full bg-zinc-200 rounded-full h-4 mt-5">
        //     <div
        //         className={`h-4 rounded-full transition-all duration-500 ${progress !== 100
        //                 ? "bg-blue-500"
        //                 : "bg-green-500"
        //             }`}
        //         style={{ width: `${progress}%` }}
        //     />
        //     <span
        //         className={`absolute inset-0 text-xs flex items-center justify-center transition-colors duration-300 ${progress < 50
        //                 ? "text-gray-500"
        //                 : progress < 80
        //                     ? "text-white"
        //                     : progress < 90
        //                         ? "text-orange-300"
        //                         : progress < 99
        //                             ? "text-red-300 font-bold"
        //                             : progress < 100
        //                                 ? "text-red-500 font-bold"
        //                                 : "text-white font-bold"
        //             }`}
        //     >
        //         {progress}%
        //     </span>
        // </div>

        <div className="mt-4">
            <div className="relative w-full bg-zinc-200 rounded-full h-6 overflow-hidden">
                <div
                    className={`h-6 rounded-full transition-all duration-500 ${getColorClass()}`}
                    style={{ width: `${progress}%` }}
                />
                <span
                    className={`absolute inset-0 text-xs font-semibold flex items-center justify-center ${getTextColor()}`}
                >
                    {progress}%
                </span>
            </div>
        </div>
    );
}
