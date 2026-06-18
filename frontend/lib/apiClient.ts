import axios from "axios";
import { signOut } from "next-auth/react";
import { refreshAccessToken } from "./authRefresh";

let signingOut = false;

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        const original: any = err?.config; // _retried 커스텀 플래그 부착 위해 any

        if (err?.response?.status === 401 && original) {
            // 1) 첫 401: 통합 토큰 만료 가능 → refresh 1회 시도 후 원요청 재시도
            if (!original._retried) {
                original._retried = true;
                if (await refreshAccessToken()) {
                    return api(original); // 새 access_token 쿠키로 재시도
                }
            }
            // 2) refresh 미설정(개발)/실패 또는 재시도 후에도 401 → 로그아웃
            if (!signingOut) {
                signingOut = true;
                console.warn("[AUTH] 401 → refresh 실패/미설정 → signOut");
                await signOut({ callbackUrl: "/auth/signin" });
                signingOut = false;
            }
        }

        return Promise.reject(err);
    }
);
