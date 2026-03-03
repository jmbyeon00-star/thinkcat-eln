import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
    // A list of all locales that are supported
    locales: ['ko', 'en', 'ja', 'zh'],

    // Used when no locale matches
    defaultLocale: 'ko',

    // The locale prefix to use in URLs
    localePrefix: 'always'
});

export const { locales, localePrefix } = routing;

// Lightweight wrappers around Next.js navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } =
    createNavigation(routing);
