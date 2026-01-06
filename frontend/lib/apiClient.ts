import axios from "axios";
import { signOut } from "next-auth/react";

let signingOut = false;

export const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
    timeout: 30_000,
    headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
    (res) => res,
    async (err) => {
        if (err?.response?.status === 401 && !signingOut) {
            signingOut = true;
            console.warn("[AUTH] 401 → auto signOut");
            await signOut({ callbackUrl: "/auth/signin" });
            signingOut = false;
        }
        return Promise.reject(err);
    }
);
