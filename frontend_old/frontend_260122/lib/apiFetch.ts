// lib/apiFetch.ts
import { signOut } from "next-auth/react";

let signingOut = false;

export async function apiFetch(input: RequestInfo, init?: RequestInit) {
    const res = await fetch(input, init);

    if (res.status === 401) {
        // 중복 호출 방지 (여러 API가 동시에 401 뜨는 경우)
        if (!signingOut) {
            signingOut = true;
            console.warn("[AUTH] 401 → auto signOut");
            await signOut({ callbackUrl: "/auth/signin" });
            signingOut = false;
        }
        throw new Error("UNAUTHORIZED");
    }

    return res;
}
