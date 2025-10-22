// pages/_app.tsx
import type { AppProps } from 'next/app';
import { SessionProvider } from "next-auth/react";
import Layout from '../components/layouts/Layout';
import '../styles/globals.css';

import useProgressListener from '@/lib/hooks/useStatusListener'
import { getUserId } from '@/utils/auth'

function GlobalStatusListener({ userId }: { userId: number | null }) {
  if (!userId) return

  useProgressListener(userId)
  return null // 이 컴포넌트는 화면에 아무것도 렌더링하지 않음
}

export default function MyApp({
  Component,
  pageProps: { session, ...pageProps }
}: AppProps) {
  const userId = getUserId() ?? null

  return (
    <SessionProvider session={session}>
      {/* 전역 SSE 리스너 추가 */}
      <GlobalStatusListener userId={userId} />

      <Layout>
        <Component {...pageProps} />
      </Layout>
    </SessionProvider>
  );
}


MyApp.getInitialProps = async () => ({ pageProps: {} })