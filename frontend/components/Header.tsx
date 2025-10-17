import Link from 'next/link';
import { useEffect, useState } from 'react';
import { User, LogOut, Menu, X } from 'lucide-react';

export default function Header() {
    const [user, setUser] = useState<any>(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        try {
          const u = localStorage.getItem('user');
          if (u) {
            const parsed = JSON.parse(u);
            if (parsed) setUser(parsed);
          }
        } catch (e) {
          console.warn("user parsing failed", e);
          localStorage.removeItem('user');
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/';
    };

    const navLinks = [
        { href: '/about', label: '서비스 소개' },
        { href: '/project/new', label: '프로젝트 생성' },
        { href: '/project', label: '프로젝트 관리' },
        { href: '/collection', label: '컬렉션 관리' },
        { href: '/ai', label: '모델 관리' },
        { href: '/file', label: '파일 관리' },
        { href: '/search', label: '검색' },
    ];

    return (
        <>
            <header className="sticky top-0 z-50 bg-white border-b border-zinc-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex-shrink-0">
                            <Link href="/" className="flex items-center gap-2">
                                {/* <div className="w-1 h-8 bg-gradient-to-b from-blue-600 to-indigo-600 rounded-full" /> */}
                                <img 
                                    src="/logo3.svg" 
                                    alt="IPFORCE Logo" 
                                    className="h-9"
                                />
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

                        {/* Auth Buttons - Desktop */}
                        <div className="hidden lg:flex items-center gap-2">
                            {!user ? (
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
                                    <Link
                                        href="/mypage"
                                        className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                    >
                                        <User size={16} />
                                        마이페이지
                                    </Link>
                                    <button
                                        onClick={handleLogout}
                                        className="px-4 py-2 text-sm font-medium text-zinc-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 flex items-center gap-2"
                                    >
                                        <LogOut size={16} />
                                        로그아웃
                                    </button>
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
                                            마이페이지
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
        </>
    );
}