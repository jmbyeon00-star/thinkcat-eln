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
                                        className="relative w-10 h-10 rounded-full"
                                    >
                                        {/* 회전하는 어두운 그라디언트 테두리 */}
                                        {isBusy && (
                                            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 animate-spin blur-sm" />
                                        )}
                                        {/* 프로필 이미지 */}
                                        <img
                                            src={user.image || "/default-profile.png"}
                                            alt="Profile"
                                            className="relative z-10 w-full h-full object-cover rounded-full border-2 border-white"
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
