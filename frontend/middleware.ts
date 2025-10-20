// frontend/middleware.ts
export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/project/:path*",      // 프로젝트 관련 페이지 보호
    "/collection/:path*",   // 컬렉션 관리 페이지 보호
    "/ai/:path*",           // AI 모델 관리 페이지 보호
    "/file/:path*",         // 파일 관리 페이지 보호
    "/search/:path*"        // 검색 페이지 보호
  ],
};
