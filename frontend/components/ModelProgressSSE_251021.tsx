// components/ModelProgressSSE.tsx
"use client";
import { useEffect, useState } from "react";

export default function ModelProgressSSE({ targetId }: { targetId: number, initialProgress: number }) {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        // const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
        const base = "http://192.168.1.20:8000"
        const es = new EventSource(`${base}/api/status/progress/stream/${targetId}`);

        es.onmessage = (e) => {
            setProgress(Number(e.data));
        };

        es.onerror = (err) => {
            console.error("SSE error:", err);
            es.close();
        };

        return () => es.close();
    }, [targetId]);

    return (
        // <div className="relative w-40 bg-zinc-200 rounded-full h-4">
        <div className="relative w-full bg-zinc-200 rounded-full h-4 mt-5">
            <div
                className={`h-4 rounded-full transition-all duration-500 ${progress !== 100
                        ? "bg-blue-500"
                        : "bg-green-500"
                    }`}
                style={{ width: `${progress}%` }}
            />
            <span
                className={`absolute inset-0 text-xs flex items-center justify-center transition-colors duration-300 ${progress < 50
                        ? "text-gray-500"
                        : progress < 80
                            ? "text-white"
                            : progress < 90
                                ? "text-orange-300"
                                : progress < 99
                                    ? "text-red-300 font-bold"
                                    : progress < 100
                                        ? "text-red-500 font-bold"
                                        : "text-white font-bold"
                    }`}
            >
                {progress}%
            </span>
        </div>
    );
}
