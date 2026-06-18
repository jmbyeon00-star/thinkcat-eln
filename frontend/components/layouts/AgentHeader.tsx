'use client';

// import Link from "next/link";
// import { useRouter } from "next/router";
import { useState } from "react";
import { User, LogOut, Menu, X, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/authLogout";
import { Link, useRouter, usePathname } from "@/routing";
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from "next-intl";
import { loginHref, signupHref } from "@/lib/authNav";

// 로그인/회원가입 진입점은 환경에 따라 분기된다(@/lib/authNav):
// 운영(통합) → thinkcat.kr 포털, 개발 → 자체 /auth/signin·/auth/signup
const PORTAL_LOGIN_URL = loginHref;
const PORTAL_SIGNUP_URL = signupHref;

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
        await logout({ redirect: false });
        // router.push(`/${router.locale}`); // 실제 환경용
    };

    const handleHomeClick = () => {
        if (onHome) onHome();
        setMobileMenuOpen(false);
    };

    // 메인화면에서는 메뉴 숨김, 그 외 페이지에서 표시
    const isHome = currentPath === '/';

    const navLinks = [
        { href: "/agent/marketplace", label: "header.marketplace" },
        { href: "/search", label: "header.search" },
        { href: "/prior-art", label: "header.priorArt" },
        { href: "/announcement", label: "header.announcement" },
    ];

    const getLinkClasses = (href: string, isMobile: boolean = false) => {
        const isActive = currentPath === href || currentPath.startsWith(`${href}/`);
        if (!isMobile) {
            return `flex items-center justify-center px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 whitespace-nowrap ${isActive
                ? 'text-blue-600 bg-blue-50'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`;
        }
        return `block px-4 py-3 text-base font-bold rounded-xl transition-all ${isActive ? 'bg-blue-50 text-blue-600' : 'text-zinc-600 hover:bg-zinc-50'}`;
    };

    return (
        <header className="sticky top-4 z-[100] px-4 md:px-8 w-full">
            <div className="max-w-6xl mx-auto bg-white/90 backdrop-blur-md border border-zinc-200 rounded-2xl shadow-md px-6">
                <div className="flex items-center h-14">

                    <div className="flex-1 flex justify-start">
                        <Link href="/" onClick={handleHomeClick} className="flex items-center group transition-transform active:scale-95">
                            <img src="/logo.svg" alt="ThinkCat ELN" className="h-12 w-auto -mt-3" />
                        </Link>
                    </div>

                    {!isHome && (
                        <nav className="hidden lg:flex items-center justify-center gap-1">
                            {navLinks.map((link) => (
                                <Link key={link.href} href={link.href} className={getLinkClasses(link.href)}>
                                    {translator(link.label)}
                                </Link>
                            ))}
                        </nav>
                    )}

                    <div className="flex-1 hidden lg:flex items-center justify-end gap-4">
                        <LanguageSwitcher />
                        {authStatus === 'loading' ? (
                            <div className="w-16 h-8 bg-zinc-100 animate-pulse rounded-lg" />
                        ) : !user ? (
                            <>
                                <a href={PORTAL_SIGNUP_URL} className="text-sm font-bold text-zinc-500 hover:text-zinc-900 transition-colors">{translator('header.get_started')}</a>
                                <a href={PORTAL_LOGIN_URL} className="px-4 py-2 text-sm font-black text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all active:scale-95">{translator('header.login')}</a>
                            </>
                        ) : (
                            <div className="relative">
                                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 group p-1 pr-2 rounded-full hover:bg-zinc-50 transition-all">
                                    <div className="w-7 h-7 rounded-full border border-zinc-200 bg-zinc-100 flex items-center justify-center overflow-hidden">
                                        {user.image ? <img src={user.image} alt="Profile" className="w-full h-full object-cover" /> : <User size={15} className="text-zinc-400" />}
                                    </div>
                                    <ChevronDown size={13} className={`text-zinc-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {menuOpen && (
                                    <div className="absolute right-0 mt-3 w-48 bg-white border border-zinc-100 rounded-2xl shadow-2xl py-2 z-[110]">
                                        <Link href="/mypage" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-zinc-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                            <User size={15} /> {translator('header.mypage')}
                                        </Link>
                                        <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                                            <LogOut size={15} /> {translator('header.logout')}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden p-2 text-zinc-900 hover:bg-zinc-100 rounded-lg transition-all">
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-zinc-100 py-3 space-y-1">
                        {!isHome && navLinks.map((link) => (
                            <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className={getLinkClasses(link.href, true)}>
                                {translator(link.label)}
                            </Link>
                        ))}
                        {!user ? (
                            <>
                                <a href={PORTAL_SIGNUP_URL} onClick={() => setMobileMenuOpen(false)} className="block px-2 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-50 rounded-xl text-center">{translator('header.get_started')}</a>
                                <a href={PORTAL_LOGIN_URL} onClick={() => setMobileMenuOpen(false)} className="block px-2 py-2.5 text-sm font-black text-white bg-blue-600 rounded-xl text-center">{translator('header.login')}</a>
                            </>
                        ) : (
                            <>
                                <Link href="/mypage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-2 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-50 rounded-xl"><User size={15} /> {translator('header.mypage')}</Link>
                                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="w-full flex items-center gap-2 px-2 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl"><LogOut size={15} /> {translator('header.logout')}</button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
}