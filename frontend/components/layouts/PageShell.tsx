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
    children: React.ReactNode;
}

export default function PageShell({ title, description, actions, children }: PageShellProps) {
    return (
        <main className="min-h-screen bg-white">
            <div className="max-w-6xl mx-auto px-6 pt-12 pb-24">

                {/* 페이지 헤더 */}
                <div className="flex items-end justify-between gap-4 mb-10">
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
