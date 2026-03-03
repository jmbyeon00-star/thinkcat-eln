import { getRequestConfig } from 'next-intl/server';
import { locales } from '../routing';
import { notFound } from 'next/navigation';

export default getRequestConfig(async (params: any) => {
    // Newer next-intl versions (>= 3.0) might pass requestLocale which needs to be awaited
    // or sometimes it's still just locale. Let's handle both and log for clarity.
    console.log('[i18n/request] getRequestConfig params:', JSON.stringify(Object.keys(params)));

    let locale = params.locale;
    if (!locale && params.requestLocale) {
        locale = await params.requestLocale;
    }

    console.log(`[i18n/request] Final resolved locale: ${locale}`);

    // If still undefined, fallback to default locale or return notFound
    if (!locale || !locales.includes(locale as any)) {
        console.log(`[i18n/request] Invalid/Missing locale: ${locale}. Falling back to 'ko'`);
        locale = 'ko';
    }

    try {
        const messages = (await import(`../messages/${locale}.json`)).default;
        console.log(`[i18n/request] Successfully loaded messages for: ${locale}`);
        return {
            locale: locale as string,
            messages
        };
    } catch (error) {
        console.error(`[i18n/request] Failed to load messages for: ${locale}`, error);
        notFound();
    }
});
