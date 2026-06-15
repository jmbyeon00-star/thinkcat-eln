'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "@/routing";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "loading") return;
        if (!session || (session as any).user?.role !== "admin") {
            router.replace("/");
        }
    }, [session, status, router]);

    if (status === "loading" || !session || (session as any).user?.role !== "admin") {
        return null;
    }

    return (
        <div className="min-h-screen bg-zinc-950 text-white">
            <nav className="border-b border-zinc-800 px-8 py-4 flex items-center gap-6">
                <span className="font-black text-lg tracking-tight">
                    THINKCAT<span className="text-blue-500">.</span>ADMIN
                </span>
                <a href="/admin" className="text-sm text-zinc-400 hover:text-white transition-colors">대시보드</a>
                <a href="/admin/note-test" className="text-sm text-zinc-400 hover:text-white transition-colors">노트 추출 테스트</a>
                <a href="/admin/search" className="text-sm text-zinc-400 hover:text-white transition-colors">AI 검색</a>
            </nav>
            <main className="px-8 py-8">
                {children}
            </main>
        </div>
    );
}
