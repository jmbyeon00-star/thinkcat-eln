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
      pathWithoutLocale.startsWith("/notice") ||
      pathWithoutLocale.startsWith("/announcement") ||
      pathWithoutLocale.startsWith("/search") ||
      pathname.includes(".") ||
      pathname.includes("/api/") ||
      pathname.includes("/_next/") ||
      pathname === "/favicon.ico";

    // 로그인이 필요한 리퀘스트인데 토큰이 없는 경우
    // 로그인이 필요한 리퀘스트인데 토큰이 없는 경우
    if (!isPublicPath && !token) {
      // 현재 적용된 로케일을 찾음 (URL의 첫 번째 세그먼트)
      const segments = pathname.split('/');
      const currentSegment = segments[1];
      
      // [최종 해결] currentSegment를 먼저 any로 취급하여 includes 검사를 통과시킵니다.
      const locale = locales.includes(currentSegment as any) 
        ? (currentSegment as any) 
        : 'ko';

      const signInUrl = new URL(`/${locale}/auth/signin`, req.nextUrl.origin);
      signInUrl.searchParams.set("callbackUrl", pathname);
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