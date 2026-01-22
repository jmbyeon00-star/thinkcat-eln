import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const res = NextResponse.next();

    // 1. 언어 쿠키(NEXT_LOCALE) 강제화
    // 사용자가 /en 이나 /ko로 들어오면 그 값을 쿠키에 저장해 세션을 유지합니다.
    const locale = req.nextUrl.locale || "ko";
    res.cookies.set("NEXT_LOCALE", locale, { path: "/" });

    return res;
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // [인증 예외 경로]
        // 1. 정적 파일 (확장자가 있는 경우)
        if (pathname.includes(".")) return true;

        // 2. 인증 관련 페이지 (/auth/signin, /auth/signup 등)
        // Pages Router는 locale이 앞에 붙어도 내부 pathname은 /auth/...로 인식됩니다.
        if (pathname.startsWith("/auth")) return true;

        // 3. 공용 페이지 (필요시 추가)
        if (pathname === "/") return true;

        // 나머지는 로그인이 되어 있어야 함 (token 존재 여부)
        return !!token;
      },
    },
    pages: {
      // 로그인이 안 된 사용자를 보낼 페이지
      signIn: "/auth/signin",
    },
  }
);

export const config = {
  // api, _next, 정적 파일들을 제외한 모든 경로에서 실행
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};