import { signOut } from "next-auth/react";
import { refreshAccessToken } from "./authRefresh";

let signingOut = false;

/**
 * fetch 드롭인 래퍼 (백엔드 API 호출용).
 *
 * - `credentials: 'include'` 를 기본 적용해 통합 로그인 쿠키(access_token)를 동봉한다.
 * - 응답이 401 이면 통합 토큰 만료로 보고 refresh 를 1회 시도한 뒤 원요청을 재시도한다.
 * - refresh 가 미설정(개발)이거나 실패하면, 또는 재시도 후에도 401 이면 로그아웃한다.
 * - 반환 타입이 표준 `Response` 라 기존 `res.ok` / `res.json()` 코드와 그대로 호환된다.
 *
 * 주의: 재시도를 위해 같은 input/init 로 다시 호출하므로, body 는 스트림이 아닌
 *       문자열/객체(직렬화된 값)여야 한다. (현재 호출부는 전부 string body)
 */
export async function apiFetch(
    input: RequestInfo | URL,
    init: RequestInit = {},
): Promise<Response> {
    const withCreds: RequestInit = { credentials: "include", ...init };

    let res = await fetch(input, withCreds);

    if (res.status === 401) {
        if (await refreshAccessToken()) {
            res = await fetch(input, withCreds); // 새 access_token 쿠키로 1회 재시도
        }
        if (res.status === 401 && !signingOut) {
            signingOut = true;
            console.warn("[AUTH] 401 → refresh 실패/미설정 → signOut");
            await signOut({ callbackUrl: "/auth/signin" });
            signingOut = false;
        }
    }

    return res;
}
