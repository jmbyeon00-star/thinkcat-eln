'use client';

import { SessionProvider, signIn, useSession } from 'next-auth/react';
import { NextIntlClientProvider } from 'next-intl';
import { SearchProvider } from '@/contexts/SearchContext';
import { useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api';
import Layout from '@/components/layouts/Layout';

/**
 * 통합 로그인(thinkcat.kr 포털) 쿠키 부트스트랩.
 * NextAuth 세션이 없을 때 /api/user/me 로 통합 쿠키(access_token)를 확인하고,
 * 로그인돼 있으면 NextAuth 세션을 자동 생성한다(__sso__ 경로).
 * → 기존 useSession 코드를 그대로 두고 patents.thinkcat.kr 에서도 로그인 상태가 된다.
 */
function SsoBootstrap() {
    const { status } = useSession();
    const tried = useRef(false);

    useEffect(() => {
        if (status !== 'unauthenticated' || tried.current) return;
        // 개발 환경에서 통합 쿠키 탐색(/api/user/me 401) 소음 차단용 — 필요 시 주석 해제
        // if (!location.hostname.endsWith('.thinkcat.kr')) return;
        tried.current = true;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/api/user/me`, { credentials: 'include' });
                if (!res.ok) return; // 통합 쿠키 없음 → 비로그인 유지
                await signIn('credentials', { redirect: false, username: '__sso__', password: '' });
            } catch {
                /* 네트워크 오류 시 비로그인 유지 */
            }
        })();
    }, [status]);

    return null;
}

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
            <SsoBootstrap />
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
