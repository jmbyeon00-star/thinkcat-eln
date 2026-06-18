import { signOut } from "next-auth/react";
import { authLogoutUrl } from "./authNav";

/**
 * 통합 로그아웃.
 *
 * - 운영(통합, NEXT_PUBLIC_AUTH_LOGOUT_URL 설정 시): 자바팀 AuthServer 글로벌 로그아웃을
 *   먼저 호출(POST + credentials:'include')해 .thinkcat.kr 쿠키(access/refresh/logout_refresh)를
 *   전부 제거 → 통합 플랫폼 + 모든 서브도메인(patents 포함)이 로그아웃된다.
 *   그 뒤 NextAuth 세션을 정리한다.
 * - 개발(URL 미설정): NextAuth signOut 만 수행(통합 쿠키가 없으므로).
 * - AuthServer 호출이 실패(CORS/네트워크)해도 로컬 세션 정리는 반드시 진행한다.
 *
 * ⚠️ access_token 은 잔여 유효기간(최대 15분) 동안 검증을 통과할 수 있다(문서 9-4).
 *    즉시 차단이 필요하면 AuthServer 측 블랙리스트가 필요하다(현 구조 범위 밖).
 */
export async function logout(
    options?: { callbackUrl?: string; redirect?: boolean },
): Promise<void> {
    if (authLogoutUrl) {
        try {
            await fetch(authLogoutUrl, { method: "POST", credentials: "include" });
        } catch {
            // 통합 로그아웃 호출이 실패해도 아래 로컬 signOut 은 진행한다.
        }
    }
    await signOut(options ?? { redirect: false });
}
