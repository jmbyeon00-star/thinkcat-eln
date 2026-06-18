import { authRefreshUrl } from "./authNav";

// 동시에 여러 요청이 401을 받아도 refresh 는 한 번만 호출한다(single-flight).
let inflight: Promise<boolean> | null = null;

/**
 * 통합 로그인 access_token 을 자바팀 AuthServer 에 재발급 요청한다.
 *
 * - 운영(NEXT_PUBLIC_AUTH_REFRESH_URL 설정 시)에서만 동작, 개발은 즉시 false(no-op).
 * - GET + credentials:'include' 로 호출 → 브라우저가 refresh_token 쿠키를 동봉.
 * - 성공 시 AuthServer 가 새 access_token 쿠키(Domain=.thinkcat.kr)를 Set-Cookie 로 내려주고
 *   브라우저가 자동 저장하므로, 우리는 성공 여부(res.ok)만 확인하면 된다.
 * - 교차 도메인 호출이므로 AuthServer CORS 가 요청 origin + credentials 를 허용해야 한다.
 */
export function refreshAccessToken(): Promise<boolean> {
    if (!authRefreshUrl) return Promise.resolve(false);
    if (inflight) return inflight;

    inflight = fetch(authRefreshUrl, { method: "GET", credentials: "include" })
        .then((res) => res.ok)
        .catch(() => false)
        .finally(() => {
            inflight = null;
        });

    return inflight;
}
