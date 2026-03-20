import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from '@/routing';
import { useLocale, useTranslations } from 'next-intl';
import Cookies from 'js-cookie';
import { Globe, ChevronDown } from 'lucide-react';

export default function LanguageSwitcher() {
    const t = useTranslations();
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = useLocale();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const languages = [
        { code: 'ko', label: t('language.ko') },
        { code: 'en', label: t('language.en') },
        { code: 'ja', label: t('language.ja') },
        { code: 'zh', label: t('language.zh') }
    ] as const;

    const currentLanguage = languages.find(lang => lang.code === currentLocale) || languages[0];

    const changeLanguage = (nextLocale: 'ko' | 'en' | 'ja' | 'zh') => {
        // Next.js Pages Router의 표준 쿠키명: 'NEXT_LOCALE'
        Cookies.set('NEXT_LOCALE', nextLocale, { expires: 365 });

        // next-intl의 useRouter.replace는 locale 옵션을 받을 수 있습니다.
        router.replace(pathname, { locale: nextLocale });
        setIsOpen(false);
    };

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 rounded-xl transition-all active:scale-95 group"
            >
                <Globe size={14} className="text-zinc-400 group-hover:text-blue-600 transition-colors" />
                <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-tight">{currentLanguage.code}</span>
                <ChevronDown size={12} className={`text-zinc-300 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 lg:left-0 lg:right-auto mt-2 w-40 bg-white border border-zinc-100 rounded-2xl shadow-2xl py-2 z-[150] animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-1.5 mb-1">
                        <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest px-1">{t('header.select_language')}</p>
                    </div>
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => changeLanguage(lang.code)}
                            className={`
                                w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-bold transition-colors
                                ${currentLocale === lang.code
                                    ? 'text-blue-600 bg-blue-50/50'
                                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900'
                                }
                            `}
                        >
                            <span>{lang.label}</span>
                            {currentLocale === lang.code && (
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
