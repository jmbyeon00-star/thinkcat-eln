// pages/_app.tsx
import { useEffect, useState, useMemo } from 'react';
import type { AppProps } from 'next/app';
import { SessionProvider, useSession } from 'next-auth/react'
import { SearchProvider } from '@/contexts/SearchContext';
import { NextIntlClientProvider } from 'next-intl';
import { useRouter } from 'next/router';

// import { getUserId } from '@/utils/auth'
import useStatusListener from '@/lib/hooks/useStatusListener'
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import Layout from '../components/layouts/Layout';
import '@/styles/globals.css';

// 항상 존재하는 "기본 번역" (Header 같은 공통 UI는 여기로 해결)
import koMessages from '@/messages/ko.json';
import enMessages from '@/messages/en.json';

function GlobalStatusListener() {
  const { data: session, status } = useSession()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const setState = useUserTaskStore(state => state.setState)
  const token = session?.access_token;

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setUserEmail(session.user.email);

      // 초기 상태 복원
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
      fetch(`/api/user/status/current`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        credentials: "include",
      })
        .then(res => res.json())
        .then(data => {
          setState({
            isBusy: data.isBusy,
            status: data.status,
            run_type: data.run_type,
            targetId: data.target_id,
            progress: data.progress,
            remaining_time: data.remaining_time,
          });
        })
        .catch(err => {
          console.error('[GlobalStatusListener] status/current fetch failed', err);
        });

      // console.log('[GlobalStatusListener] ✅ email 확인:', session.user.email)

    } else if (status === 'unauthenticated') {
      setUserEmail(null)
      console.log('[GlobalStatusListener] 🚫 미로그인 상태')
    }
  }, [status, session, token, setState])

  // 항상 최상단에서 훅 호출 (내부에서 조건 분기)
  useStatusListener(userEmail)

  return null
}

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();

  // ✅ Pages Router에서는 locale을 pageProps로 받기보다 router.locale이 기준
  const activeLocale = (router.locale ?? router.defaultLocale ?? 'ko') as 'ko' | 'en';
  // ✅ pageProps.messages가 비어도 Header가 안 죽게 "base messages"를 항상 제공
  const mergedMessages = useMemo(() => {
    const base = activeLocale === 'en' ? (enMessages as any) : (koMessages as any);
    const page = (pageProps as any)?.messages ?? {};

    // 얕은 merge (namespace 단위). 필요하면 deep merge로 바꿔도 됨.
    return {
      ...base,
      ...page,
      header: {
        ...(base.header ?? {}),
        ...(page.header ?? {}),
      },
    };
  }, [activeLocale, pageProps]);

  // 디버그 로그
  // console.log('[i18n]', {
  //   locale: activeLocale,
  //   hasMessages: !!(pageProps as any)?.messages,
  //   headerKeys: Object.keys((mergedMessages as any)?.header ?? {}),
  // });

  return (
    <SessionProvider
      session={(pageProps as any).session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      {/* 🌐 i18n Provider */}
      <NextIntlClientProvider
        locale={activeLocale}
        messages={mergedMessages}
        timeZone="Asia/Seoul"
        now={new Date()}
      // dev에서만 누락 경고를 덜 시끄럽게 하고 싶으면 사용
      // onError={(err) => {
      // if (process.env.NODE_ENV === 'development') console.warn('[next-intl]', err);
      // }}
      >

        {/* 전역 SSE 리스너 */}
        <SearchProvider>
          <GlobalStatusListener />

          <Layout>
            <Component {...pageProps} />
          </Layout>
        </SearchProvider>

      </NextIntlClientProvider>
    </SessionProvider>
  );
}

// MyApp.getInitialProps = async () => ({ pageProps: {} });