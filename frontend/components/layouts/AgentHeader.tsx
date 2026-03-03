'use client';

// import Link from "next/link";
// import { useRouter } from "next/router";
import { useState } from "react";
import { User, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { Link, useRouter, usePathname } from "@/routing";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from "next-intl";

/**
 * Header 컴포넌트
 */
interface HeaderProps {
    onHome?: () => void;
}

export default function Header({ onHome }: HeaderProps) {
    const translator = useTranslations();
    const appRouter = useRouter();
    const appPathname = usePathname();
    const currentPath = appPathname;

    // const currentPath = router.asPath.split("?")[0].split("#")[0].replace(/^\/(en|ko)/, "");
    const { data: session, status: authStatus } = useSession();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    const user = session?.user;

    const handleLogout = async () => {
        await signOut({ redirect: false });
        // router.push(`/${router.locale}`); // 실제 환경용
    };

    const handleHomeClick = () => {
        if (onHome) onHome();
        setMobileMenuOpen(false);
    };

    const navLinks = [
        { href: "/about", label: "header.about" },
        { href: "/notice", label: "header.notice" },
        { href: "/announcement", label: "header.announcement" },
        { href: "/agent/marketplace", label: "header.marketplace" },
        // { href: "/agent/attorney", label: "변리사" },
        { href: "/search", label: "header.search" },
    ];

    const getLinkClasses = (href: string, isMobile: boolean = false) => {
        const isActive = currentPath === href;
        if (!isMobile) {
            return `relative flex items-center justify-center px-2 py-2 text-sm font-bold transition-all duration-300 whitespace-nowrap min-w-[120px] ${isActive
                ? 'text-blue-600 after:absolute after:bottom-[-22px] after:left-0 after:w-full after:h-0.5 after:bg-blue-600'
                : 'text-zinc-500 hover:text-zinc-900'
                }`;
        }
        return `block px-4 py-3 text-base font-bold rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-600' : 'text-zinc-600 hover:bg-zinc-50'}`;
    };

    return (
        <header className="sticky top-0 z-[100] bg-white/80 backdrop-blur-md border-b border-zinc-100 w-full">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center h-16">

                    <div className="flex-1 flex justify-start">
                        <Link
                            href="/"
                            onClick={handleHomeClick}
                            className="flex items-center group transition-transform active:scale-95"
                        >
                            <span className="text-2xl font-black tracking-tighter text-zinc-900 leading-none">
                                THINKCAT-ELN
                                <span className="text-orange-600 transition-colors group-hover:text-red-600">.</span>
                            </span>
                        </Link>
                    </div>

                    <nav className="hidden lg:flex items-center justify-center w-[500px] h-full">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={getLinkClasses(link.href)}
                                onClick={() => link.href === "/search" && handleHomeClick()}
                            >
                                {translator(link.label)}
                            </Link>
                        ))}
                    </nav>

                    <div className="flex-1 flex items-center justify-end gap-6">
                        <div className="hidden lg:flex items-center gap-6">
                            {/* 실제 로직이 포함된 LanguageSwitcher */}
                            <LanguageSwitcher />

                            <div className="h-4 w-px bg-zinc-200" />
                            {!user ? (
                                <div className="flex items-center gap-5 whitespace-nowrap">
                                    <Link href="/auth/signin" className="text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">로그인</Link>
                                    <Link href="/auth/signup" className="px-5 py-2 text-sm font-black text-white bg-zinc-900 rounded-xl hover:bg-black shadow-lg transition-all active:scale-95">시작하기</Link>
                                </div>
                            ) : (
                                <div className="relative">
                                    <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 group p-1 pr-2 rounded-full hover:bg-zinc-50 transition-all">
                                        <div className="relative">
                                            <div className="w-8 h-8 rounded-full border border-zinc-200 bg-zinc-100 flex items-center justify-center overflow-hidden">
                                                {user.image ? <img src={user.image} alt="Profile" className="w-full h-full object-cover" /> : <User size={16} className="text-zinc-400" />}
                                            </div>
                                        </div>
                                        <ChevronDown size={14} className={`text-zinc-400 group-hover:text-zinc-900 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {menuOpen && (
                                        <div className="absolute right-0 mt-3 w-56 bg-white border border-zinc-100 rounded-[1.5rem] shadow-2xl py-3 z-[110] animate-in fade-in zoom-in-95 duration-200">
                                            <div className="px-4 py-2 border-b border-zinc-50 mb-2">
                                                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest text-center">Account Settings</p>
                                            </div>
                                            <Link href="/mypage" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-zinc-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                                <User size={16} /> 마이페이지
                                            </Link>
                                            <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                                                <LogOut size={16} /> 로그아웃
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-zinc-900 hover:bg-zinc-100 rounded-xl transition-all">
                            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>

                </div>
            </div>

            {mobileMenuOpen && (
                <div className="lg:hidden bg-white border-t border-zinc-100 p-4 space-y-2 animate-in slide-in-from-top-2">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={getLinkClasses(link.href, true)}
                            onClick={(e: any) => {
                                if (link.href === "/search") {
                                    e.preventDefault();
                                    handleHomeClick();
                                } else {
                                    setMobileMenuOpen(false);
                                }
                            }}
                        >
                            {link.label}
                        </Link>
                    ))}
                    <div className="pt-4 border-t border-zinc-50 flex items-center justify-between px-4">
                        <LanguageSwitcher />
                    </div>
                </div>
            )}
        </header>
    );
}