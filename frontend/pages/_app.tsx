// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider, useSession } from 'next-auth/react'
import Layout from '../components/layouts/Layout';
import '../styles/globals.css';

import useStatusListener from '@/lib/hooks/useStatusListener'
import { getUserId } from '@/utils/auth'
import { useEffect, useState } from 'react';

function GlobalStatusListener() {
  const { data: session, status } = useSession()
  const [userEmail, setUserEmail] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      setUserEmail(session.user.email)
      console.log('[GlobalStatusListener] ✅ email 확인:', session.user.email)
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
  pageProps: { session, ...pageProps }
}: AppProps) {
  // const userId = getUserId() ?? null

  return (
    <SessionProvider session={session}>
      {/* 전역 SSE 리스너 추가 */}
      <GlobalStatusListener />

      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  );
}


MyApp.getInitialProps = async () => ({ pageProps: {} })