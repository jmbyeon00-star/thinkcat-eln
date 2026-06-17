/**
 * 로그인/회원가입 공통 레이아웃
 * - 화면 중앙 정렬, 배경 블러 장식을 통일한다.
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <main className="min-h-screen bg-white selection:bg-blue-100 flex items-center justify-center p-6 relative overflow-hidden text-zinc-900">
            {/* 배경 장식 (심플한 블러 효과) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 pointer-events-none opacity-40">
                <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-blue-50 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-zinc-100 rounded-full blur-[100px]" />
            </div>
            {children}
        </main>
    );
}
