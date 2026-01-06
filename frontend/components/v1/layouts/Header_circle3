"use client";
import Link from "next/link";
import { useState } from "react";
import { User, LogOut, Menu, X } from "lucide-react";
import { useSession, signOut } from "next-auth/react";

import { useUserTaskStore } from '@/lib/store/useUserTaskStore';

export default function Header() {
    const { isBusy, progress, status: taskStatus } = useUserTaskStore()
    const { data: session, status: authStatus } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const user = session?.user; // ✅ 세션에서 사용자 정보 가져오기

    const handleLogout = async () => {
        await signOut({ redirect: true, callbackUrl: "/" }); // ✅ 쿠키 삭제 + 리다이렉트
    };

    const navLinks = [
        { href: "/about", label: "서비스 소개" },
        { href: "/project/new", label: "프로젝트 생성" },
        { href: "/project", label: "프로젝트 관리" },
        { href: "/collection", label: "컬렉션 관리" },
        { href: "/ai", label: "모델 관리" },
        { href: "/file", label: "파일 관리" },
        { href: "/search", label: "검색" },
    ];

    return (
        <header className="sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div className="flex-shrink-0">
                        <Link href="/" className="flex items-center gap-2">
                            <img src="/logo3.svg" alt="IPFORCE Logo" className="h-5" />
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="px-3 py-2 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                            >
                                {link.label}
                            </Link>
                        ))}
                    </nav>

                    {/* Auth Buttons */}
                    <div className="hidden lg:flex items-center gap-2">
                        {authStatus === "loading" ? (
                            <p className="text-sm text-zinc-500">로딩 중...</p>
                        ) : !user ? (
                            <>
                                <Link
                                    href="/auth/signin"
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                >
                                    로그인
                                </Link>
                                <Link
                                    href="/auth/signup"
                                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                                >
                                    회원가입
                                </Link>
                            </>
                        ) : (
                            <>
                                {/* <Link
                                    href="/mypage"
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                >
                                    <User size={16} />
                                    {user.name || user.email || "마이페이지"}
                                </Link>
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                >
                                    <LogOut size={16} />
                                    로그아웃
                                </button> */}
                                {/* ✅ 동그란 아이콘 */}
                                <div className="relative">
                                    <button
                                        onClick={() => setMenuOpen(!menuOpen)}
                                        className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all"
                                    >
                                        {/* 회전하는 외곽선 */}
                                        {isBusy && (
                                            // <span className="absolute inset-[-4px] rounded-full border-2 border-transparent border-t-blue-500 border-r-blue-500 animate-spin"></span>
                                            <span className="absolute inset-[-2px] rounded-full border-4 border-transparent border-t-yellow-500 border-r-yellow-500 animate-slow-spin shadow-[0_0_6px_rgba(37,99,235,0.4)]"></span>
                                            // <span className="absolute inset-[-3px] rounded-full 
                                            //         bg-[conic-gradient(from_0deg,
                                            //             rgba(255,255,255,1)_0%,
                                            //             rgba(200,230,255,1)_5%,
                                            //             rgba(150,200,255,0.8)_12%,
                                            //             rgba(100,170,255,0.5)_20%,
                                            //             transparent_30%,
                                            //             transparent_100%
                                            //         )] 
                                            //         animate-spin blur-[0.5px] 
                                            //         shadow-[0_0_20px_rgba(200,230,255,0.9),0_0_10px_rgba(255,255,255,1)]"
                                            // ></span>
                                            // <>
                                            //     {/* 외부 글로우 (가장 큰 후광) */}
                                            //     <span
                                            //         className="absolute inset-[-8px] rounded-full 
                                            //                 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.4),transparent_50%)]
                                            //                 blur-[8px] animate-pulse"
                                            //     ></span>

                                            //     {/* 혜성 꼬리 효과 */}
                                            //     <span
                                            //         className="absolute inset-[-5px] rounded-full 
                                            //                 bg-[conic-gradient(from_-45deg_at_70%_70%,transparent_0%,rgba(147,197,253,0.6)_5%,rgba(255,255,255,0.9)_15%,rgba(255,255,255,0.4)_25%,transparent_40%)]
                                            //                 animate-slow-spin blur-[2px] 
                                            //                 shadow-[0_0_20px_rgba(147,197,253,0.5)]"
                                            //     ></span>

                                            //     {/* 메인 회전 광선 */}
                                            //     <span
                                            //         className="absolute inset-[-3px] rounded-full 
                                            //                 bg-[conic-gradient(from_0deg_at_30%_30%,rgba(255,255,255,1)_0%,rgba(255,255,255,0.8)_8%,rgba(255,255,255,0.3)_15%,transparent_50%,transparent_100%)] 
                                            //                 animate-slow-spin blur-[1px] 
                                            //                 shadow-[0_0_15px_rgba(255,255,255,0.8),inset_0_0_10px_rgba(255,255,255,0.3)]"
                                            //     ></span>

                                            //     {/* 반대 방향 보조 광선 */}
                                            //     <span
                                            //         className="absolute inset-[-2px] rounded-full 
                                            //                 bg-[conic-gradient(from_180deg_at_30%_30%,rgba(255,255,255,0.6)_0%,rgba(255,255,255,0.2)_10%,transparent_30%)]
                                            //                 animate-reverse-spin blur-[1px]"
                                            //     ></span>

                                            //     {/* 중심 밝은 코어 */}
                                            //     <span
                                            //         className="absolute inset-[2px] rounded-full 
                                            //                 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9),rgba(255,255,255,0.3)_40%,transparent_70%)]
                                            //                 shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse"
                                            //     ></span>
                                            // </>
                                        )}
                                        {/* 프로필 이미지 */}
                                        <img
                                            src={user.image || "/default-profile.png"}
                                            alt="Profile"
                                            className="w-full h-full object-cover rounded-full"
                                        />
                                    </button>

                                    {/* ✅ 드롭다운 메뉴 */}
                                    {menuOpen && (
                                        <div className="absolute right-0 mt-2 w-40 bg-white border border-zinc-200 rounded-lg shadow-lg py-2 z-50">
                                            <Link
                                                href="/mypage"
                                                onClick={() => setMenuOpen(false)}
                                                className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100"
                                            >
                                                마이페이지
                                            </Link>
                                            <button
                                                onClick={() => {
                                                    handleLogout();
                                                    setMenuOpen(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                            >
                                                로그아웃
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Mobile menu button */}
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="lg:hidden p-2 text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {mobileMenuOpen && (
                <div className="lg:hidden border-t border-zinc-200 bg-white">
                    <div className="px-4 py-4 space-y-1">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className="block px-4 py-3 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}

                        <div className="pt-4 mt-4 border-t border-zinc-200 space-y-1">
                            {!user ? (
                                <>
                                    <Link
                                        href="/auth/signin"
                                        className="block px-4 py-3 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        로그인
                                    </Link>
                                    <Link
                                        href="/auth/signup"
                                        className="block px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-center"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        회원가입
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href="/mypage"
                                        className="block px-4 py-3 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                        onClick={() => setMobileMenuOpen(false)}
                                    >
                                        <User size={16} />
                                        {user.name || "마이페이지"}
                                    </Link>
                                    <button
                                        onClick={() => {
                                            handleLogout();
                                            setMobileMenuOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-3 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                    >
                                        <LogOut size={16} />
                                        로그아웃
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}
