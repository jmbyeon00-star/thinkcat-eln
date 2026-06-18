/**
 * 로그인/회원가입 진입점 환경 분기.
 *
 * - 운영(.thinkcat.kr): 통합 플랫폼(AuthServer)에서만 로그인/가입.
 *   NEXT_PUBLIC_AUTH_LOGIN_URL 이 설정돼 있으면 통합 모드로 본다.
 * - 개발(192.168.1.x 등): 통합 쿠키를 받을 수 없으므로 자체 /auth/signin·/auth/signup 사용.
 *
 * NEXT_PUBLIC_* 이므로 클라이언트에서도 읽을 수 있다.
 */

const PORTAL_LOGIN_URL = process.env.NEXT_PUBLIC_AUTH_LOGIN_URL || "";
// 회원가입 URL은 로그인 URL에서 유추(.../login → .../signup). 별도 env가 없을 때의 기본 규칙.
const PORTAL_SIGNUP_URL = PORTAL_LOGIN_URL.replace(/\/login(\b|$)/, "/signup");

/** 통합 로그인 모드인지 (운영) */
export const isIntegratedAuth = !!PORTAL_LOGIN_URL;

/** 로그인 버튼이 갈 곳 (운영=포털 절대URL, 개발=자체 내부경로) */
export const loginHref = isIntegratedAuth ? PORTAL_LOGIN_URL : "/auth/signin";

/** 회원가입 버튼이 갈 곳 */
export const signupHref = isIntegratedAuth ? PORTAL_SIGNUP_URL : "/auth/signup";

/** 외부(포털) 링크면 true → <a href>, 아니면 내부 라우팅(Link) 사용 권장 */
export const isExternalAuth = isIntegratedAuth;

/**
 * 통합 access_token 갱신(refresh) 엔드포인트 (자바팀 AuthServer).
 * 운영에서만 설정. 비어 있으면(개발) 토큰 리프레시는 비활성(no-op).
 * 예: https://auth.thinkcat.kr/Anyfive_Thinkcat/api/global/auth/refresh
 */
export const authRefreshUrl = process.env.NEXT_PUBLIC_AUTH_REFRESH_URL || "";

/**
 * 통합 글로벌 로그아웃 엔드포인트 (자바팀 AuthServer).
 * 운영에서만 설정. 비어 있으면(개발) NextAuth signOut 만 수행(no-op).
 * 예: https://auth.thinkcat.kr/Anyfive_Thinkcat/api/global/auth/logout
 */
export const authLogoutUrl = process.env.NEXT_PUBLIC_AUTH_LOGOUT_URL || "";
