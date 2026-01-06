// pages/_document.tsx
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="ko">
      <Head>
        {/* SEO */}
        <meta name="description" content="IPFORCE AI 기반 R&D 솔루션" />
        <meta name="keywords" content="특허, AI, IP, R&D, IPFORCE, 아이피포스" />
        <meta name="author" content="IPFORCE" />

        {/* favicon */}
        <link rel="icon" href="/favicon.ico" />

        {/* Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

        {/* 모든 HTTP 요청을 HTTPS로 업그레이드 or 기본 메타*/}
        {/* {process.env.NODE_ENV === 'production' && (
          <>
            <meta httpEquiv="Content-Security-Policy" content="upgrade-insecure-requests" />
            <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
            <meta httpEquiv="X-Frame-Options" content="DENY" />
          </>
        )} else {
          <>
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <meta charSet="utf-8" />
            <meta name="theme-color" content="#ffffff" />
          </>
        } */}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
