// components/layouts/DataLayout.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SubTab = "data" | "preview" | "stats";

export default function DataLayout({
    projectId,
    sourceType,
    children,
}: {
    projectId: number;
    sourceType: string;
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const dataHref = `/project/${projectId}/data/${sourceType}`;

    const subTabs = [
        { id: "data", label: "데이터 추가", href: dataHref },
        { id: "preview", label: "미리보기", href: `/project/${projectId}/preview` },
        { id: "stats", label: "통계", href: `/project/${projectId}/stats` },
    ];

    // 현재 활성화된 서브 탭 확인
    const getActiveSubTab = (): SubTab => {
        if (pathname?.includes("/data")) return "data";
        if (pathname?.includes("/preview")) return "preview";
        if (pathname?.includes("/stats")) return "stats";
        return "data";
    };

    const activeSubTab = getActiveSubTab();

    return (
        <div>
            {/* 세그먼트 컨트롤 */}
            <div className="inline-flex rounded-lg border border-zinc-200 p-1 mb-8 bg-zinc-50">
                {subTabs.map((tab) => (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeSubTab === tab.id
                            ? "bg-white text-blue-600 shadow-sm"
                            : "text-zinc-600 hover:text-zinc-900"
                            }`}
                    >
                        {tab.label}
                    </Link>
                ))}
            </div>

            {/* 콘텐츠 */}
            {children}
        </div>
    );
}