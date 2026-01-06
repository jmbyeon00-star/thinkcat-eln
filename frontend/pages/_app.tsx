// pages/_app.tsx
import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { SessionProvider, useSession } from 'next-auth/react'
import { NextIntlClientProvider } from 'next-intl';

// import { getUserId } from '@/utils/auth'
import useStatusListener from '@/lib/hooks/useStatusListener'
import { useUserTaskStore } from '@/lib/store/useUserTaskStore';
import Layout from '../components/layouts/Layout';
import '../styles/globals.css';

function GlobalStatusListener() {
  const { data: session, status } = useSession()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const setState = useUserTaskStore(state => state.setState)
  const token = session?.access_token;

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setUserEmail(session.user.email)

      // 초기 상태 복원
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
      fetch(`${API_BASE}/api/user/status/current`, {
        headers: { Authorization: `Bearer ${token}` },
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
        });

      // console.log('[GlobalStatusListener] ✅ email 확인:', session.user.email)

    } else if (status === 'unauthenticated') {
      setUserEmail(null)
      console.log('[GlobalStatusListener] 🚫 미로그인 상태')
    }
  }, [status, session])

  // 항상 최상단에서 훅 호출 (내부에서 조건 분기)
  useStatusListener(userEmail)

  return null
}

export default function MyApp({
  Component,
  pageProps: { session, locale, messages, ...pageProps }
}: AppProps & {
  pageProps: {
    session?: any;
    locale?: string;
    messages?: Record<string, any>;
  };
}) {
  return (
    <SessionProvider
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
    >
      {/* 🌐 i18n Provider */}
      <NextIntlClientProvider
        locale={locale || 'ko'}
        messages={messages || {}}
      >
        {/* 전역 SSE 리스너 */}
        <GlobalStatusListener />

        <Layout>
          <Component {...pageProps} />
        </Layout>
      </NextIntlClientProvider>
    </SessionProvider>
  );
}

MyApp.getInitialProps = async () => ({ pageProps: {} });