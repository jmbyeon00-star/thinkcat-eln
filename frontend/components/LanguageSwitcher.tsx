'use client';

// components/LanguageSwitcher.tsx
import { usePathname, useRouter } from '@/routing';
import { useLocale } from 'next-intl';
import Cookies from 'js-cookie';

export default function LanguageSwitcher() {
    const router = useRouter();
    const pathname = usePathname();
    const currentLocale = useLocale();

    const changeLanguage = (nextLocale: 'en' | 'ko') => {
        // Next.js Pages Router의 표준 쿠키명: 'NEXT_LOCALE'
        Cookies.set('NEXT_LOCALE', nextLocale, { expires: 365 });

        // next-intl의 useRouter.replace는 locale 옵션을 받을 수 있습니다.
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <div className="flex items-center bg-zinc-100 p-1 rounded-lg border border-zinc-200">
            {[
                { code: 'ko', label: 'KO' },
                { code: 'en', label: 'EN' }
            ].map((lang) => (
                <button
                    key={lang.code}
                    onClick={() => changeLanguage(lang.code as 'ko' | 'en')}
                    className={`
                        px-2 py-1 text-[10px] font-bold rounded-md transition-all
                        ${currentLocale === lang.code
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800'
                        }
                    `}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
}
