'use client';

import { useSession } from "next-auth/react";
import Link from "next/link";
import { FlaskConical } from "lucide-react";

export default function AdminDashboard() {
    const { data: session } = useSession();

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-black tracking-tight">관리자 대시보드</h1>
                <p className="text-zinc-500 text-sm mt-1">{(session as any)?.user?.email}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Link
                    href="/admin/note-test"
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-blue-500 transition-colors group"
                >
                    <FlaskConical className="text-blue-500 mb-3" size={24} />
                    <h2 className="font-bold text-lg">노트 추출 테스트</h2>
                    <p className="text-zinc-500 text-sm mt-1">GPU 백엔드 /gpu/note/extract 엔드포인트 테스트</p>
                </Link>
            </div>
        </div>
    );
}
