'use client';

import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { SearchProvider } from '@/contexts/SearchContext';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Layout from '@/components/layouts/Layout';

export function Providers({
    children,
    messages,
    locale
}: {
    children: React.ReactNode;
    messages: any;
    locale: string;
}) {
    return (
        <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={true}>
            <NextIntlClientProvider
                locale={locale}
                messages={messages}
                timeZone="Asia/Seoul"
                now={new Date()}
            >
                <SearchProvider>
                    <Layout>
                        {children}
                    </Layout>
                </SearchProvider>
            </NextIntlClientProvider>
        </SessionProvider>
    );
}
