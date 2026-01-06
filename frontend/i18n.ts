import { getRequestConfig } from 'next-intl/server';

const SUPPORTED = new Set(['ko', 'en']);

export default getRequestConfig(async ({ locale }: { locale?: string }) => {
    const resolvedLocale = locale && SUPPORTED.has(locale) ? locale : 'ko';

    return {
        locale: resolvedLocale,
        messages: (await import(`./messages/${resolvedLocale}.json`)).default
    };
});