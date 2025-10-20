import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const token = req.cookies.get("access_token")?.value;
  const path = req.nextUrl.pathname;

  const protectedPaths = ["/dashboard", "/projects", "/ai"];
  const isProtected = protectedPaths.some(p => path.startsWith(p));

  if (isProtected && !token) {
    // ❌ 토큰이 없으면 로그인 페이지로 이동
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/projects/:path*", "/ai/:path*"],
};
