'use strict';

import createMiddleware from 'next-intl/middleware';
import { routing, locales } from './routing';
import { NextRequestWithAuth, withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
const intlMiddleware = createMiddleware(routing);

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // locale prefix 제거 후 순수 경로 확인
    const pathWithoutLocale = locales.reduce(
      (acc: string, locale: string) => acc.replace(`/${locale}`, ''),
      pathname
    ) || '/';

    // [중요] 특정 경로는 로그인이 없어도 접근 가능해야 함
    const isPublicPath =
      pathWithoutLocale === "/" ||
      pathWithoutLocale.startsWith("/auth") ||
      pathWithoutLocale.startsWith("/about") ||
      pathWithoutLocale.startsWith("/agent") ||
      pathWithoutLocale.startsWith("/attorney") ||
      pathWithoutLocale.startsWith("/notice") ||
      pathWithoutLocale.startsWith("/announcement") ||
      pathWithoutLocale.startsWith("/search") ||
      pathname.includes(".") ||
      pathname.includes("/api/") ||
      pathname.includes("/_next/") ||
      pathname === "/favicon.ico";

    const isAdminPath = pathWithoutLocale.startsWith("/admin");

    // admin 경로: 토큰 없거나 role이 admin이 아니면 홈으로 차단
    if (isAdminPath) {
      if (!token || (token as any).role !== "admin") {
        const segments = pathname.split('/');
        const currentSegment = segments[1];
        const locale = locales.includes(currentSegment as any) ? (currentSegment as any) : 'ko';
        return NextResponse.redirect(new URL(`/${locale}`, req.nextUrl.origin));
      }
    }

    // 통합 로그인 쿠키(access_token)가 있으면 NextAuth 토큰이 아직 없어도 로그인으로 간주
    // (클라이언트 SsoBootstrap이 NextAuth 세션을 곧 생성함)
    const hasSsoCookie = !!req.cookies.get("access_token");

    // 로그인이 필요한 리퀘스트인데 토큰이 없는 경우
    if (!isPublicPath && !token && !hasSsoCookie) {
      const segments = pathname.split('/');
      const currentSegment = segments[1];
      const locale = locales.includes(currentSegment as any)
        ? (currentSegment as any)
        : 'ko';

      // locale prefix 제거한 순수 경로로 callbackUrl 구성 (이중 locale 방지: /ko/ko/... 버그)
      const callbackPath = pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`;

      // 리버스 프록시(Apache) 뒤에서는 req.nextUrl.origin 이 내부 주소(localhost:3000)로 잡히므로
      // X-Forwarded-Host/Proto 로 실제 외부 origin(patents.thinkcat.kr)을 재구성한다.
      const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
      const fwdProto = req.headers.get("x-forwarded-proto") ?? "https";
      const realOrigin = fwdHost ? `${fwdProto}://${fwdHost}` : req.nextUrl.origin;

      // 운영(.thinkcat.kr): 통합 인증서버로, 개발: 자체 signin 으로 분기
      const authLoginUrl = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL;
      if (authLoginUrl) {
        const url = new URL(authLoginUrl);
        url.searchParams.set("redirect", `${realOrigin}/${locale}${callbackPath}`);
        return NextResponse.redirect(url);
      }

      const signInUrl = new URL(`/${locale}/auth/signin`, req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", `/${locale}${callbackPath}`);
      return NextResponse.redirect(signInUrl);
    }

    return intlMiddleware(req);
  },
  {
    callbacks: {
      // middleware 함수 내에서 직접 체크하므로 항상 true 반환하여 
      // NextAuth의 기본 비localized 리다이렉트를 방지합니다.
      authorized: () => true,
    },
  }
);

export const config = {
  // api, _next, 정적 파일들을 제외한 모든 경로에서 실행
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logos|attorney_photos|images|default-profile.png|logo.png|logo.svg).*)"],
};