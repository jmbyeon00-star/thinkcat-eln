import React from 'react';

/**
 * 서비스 페이지 공통 레이아웃 (변리사검색 / 특허검색 / 선행기술조사 / R&D공고검색)
 * - 가로폭, 상하 여백, 타이틀 위치/간격을 통일한다.
 */
interface PageShellProps {
    /** 페이지 타이틀 */
    title: React.ReactNode;
    /** 타이틀 아래 설명 (선택) */
    description?: React.ReactNode;
    /** 타이틀 우측 영역 (선택, 버튼 등) */
    actions?: React.ReactNode;
    /** 상하 여백을 줄여 본문(특히 리스트)이 첫 화면에 더 빨리 보이게 함 */
    dense?: boolean;
    children: React.ReactNode;
}

export default function PageShell({ title, description, actions, dense = false, children }: PageShellProps) {
    return (
        <main className="min-h-screen bg-white">
            <div className={`max-w-6xl mx-auto px-6 pb-24 ${dense ? "pt-6 md:pt-8" : "pt-12"}`}>

                {/* 페이지 헤더 */}
                <div className={`flex items-end justify-between gap-4 ${dense ? "mb-4 md:mb-6" : "mb-10"}`}>
                    <div className="space-y-2">
                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-zinc-900">{title}</h1>
                        {description && (
                            <p className="text-sm text-zinc-400 font-medium">{description}</p>
                        )}
                    </div>
                    {actions && <div className="shrink-0">{actions}</div>}
                </div>

                {/* 페이지 본문 */}
                {children}
            </div>
        </main>
    );
}
