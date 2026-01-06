// components/LanguageSwitcher.tsx
import { useRouter } from 'next/router';
import Cookies from 'js-cookie';

export default function LanguageSwitcher() {
    const router = useRouter();
    const { locale, asPath } = router;

    const changeLanguage = (nextLocale: 'en' | 'ko') => {
        // // Next.js Pages Router의 표준 쿠키명: 'NEXT_LOCALE'
        Cookies.set('NEXT_LOCALE', nextLocale, { expires: 365 });

        // const pathWithoutLocale = asPath.replace(/^\/(en|ko)/, '');
        // router.push(`/${nextLocale}${pathWithoutLocale}`);
        router.push(asPath, asPath, { locale: nextLocale });
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
                        ${locale === lang.code
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
