// components/layouts/DataLayout.tsx
import Link from "next/link";
import { useRouter } from "next/router";

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
    const router = useRouter();
    const pathname = router.asPath.replace(/^\/(en|ko)/, "");

    // 데이터 추가는 source_type에 따라 경로 결정
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
            {/* 서브 탭 네비게이션 */}
            <nav className="flex gap-6 border-b border-zinc-200 mb-8">
                {subTabs.map((tab) => (
                    <Link
                        key={tab.id}
                        href={tab.href}
                        className={`pb-3 text-sm font-medium transition-colors relative ${activeSubTab === tab.id
                            ? "text-blue-600"
                            : "text-zinc-600 hover:text-zinc-900"
                            }`}
                    >
                        {tab.label}
                        {activeSubTab === tab.id && (
                            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600"></span>
                        )}
                    </Link>
                ))}
            </nav>

            {/* 콘텐츠 */}
            {children}
        </div>
    );
}