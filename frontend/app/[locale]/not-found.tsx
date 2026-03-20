'use client';

import { useTranslations } from 'next-intl';

export default function NotFound() {
    const t = useTranslations('NotFound');

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <h1 className="text-4xl font-black text-zinc-900 mb-4">404</h1>
            <p className="text-zinc-600 text-lg mb-8">{t('title')}</p>
            <a
                href="/"
                className="px-6 py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-black transition-all"
            >
                {t('goHome')}
            </a>
        </div>
    );
}
