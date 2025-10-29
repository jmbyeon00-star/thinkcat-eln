// frontend/middleware.ts
import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // ✅ 인증된 사용자는 정상적으로 진행
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // ✅ 인증 관련 페이지는 항상 허용
        if (pathname.startsWith("/auth")) {
          return true;
        }

        // ✅ 보호된 경로에서는 토큰 필수
        // token이 있으면 true (접근 허용), 없으면 false (로그인 페이지로 리다이렉트)
        return !!token;
      },
    },
    pages: {
      signIn: "/auth/signin", // ✅ 인증 실패 시 리다이렉트할 페이지
    },
  }
);

export const config = {
  matcher: [
    "/project/:path*",
    "/collection/:path*",
    "/ai/:path*",
    "/file/:path*",
    "/search/:path*",
  ],
};