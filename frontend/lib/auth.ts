import { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: "credentials",
            credentials: {
                username: { label: "아이디", type: "text" },
                password: { label: "비밀번호", type: "password" },
            },
            async authorize(credentials, req) {
                const API_BASE = process.env.BACKEND_URL ?? "http://backend:8008";

                // 통합 로그인(SSO) 경로: 비밀번호 대신 브라우저의 통합 쿠키(access_token)를
                // 그대로 backend /api/user/me 로 전달해 검증한다.
                if (credentials?.username === "__sso__") {
                    const cookie = (req as any)?.headers?.cookie ?? "";
                    const meRes = await fetch(`${API_BASE}/api/user/me`, {
                        headers: { cookie },
                    });
                    const me = await meRes.json().catch(() => null);
                    if (!meRes.ok || !me?.id) return null;
                    return {
                        id: me.id,
                        name: me.name,
                        email: me.email,
                        role: me.role,
                    } as User;
                }

                // 자체 로그인(개발): 이메일 + 비밀번호
                const res = await fetch(`${API_BASE}/api/user/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: credentials?.username,
                        password: credentials?.password,
                    }),
                });

                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.ok) return null;

                return {
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    role: data.user.role,
                    token: data.access_token,
                } as User;
            },
        }),
    ],

    session: {
        strategy: "jwt",
        maxAge: 7 * 24 * 60 * 60, // 7일
    },

    // 쿠키 이름을 thinkcat-eln 전용으로 분리.
    // dev에서 ipforce와 같은 호스트(192.168.1.20, 포트만 다름)면 쿠키가 공유되는데,
    // 둘 다 기본 이름(next-auth.session-token)+다른 NEXTAUTH_SECRET이라 서로 복호화 실패
    // (JWEDecryptionFailed) → 상대 사이트 가면 로그아웃되던 문제. 이름 분리로 해소.
    cookies: {
        sessionToken: {
            name: "thinkcateln.session-token",
            options: {
                httpOnly: true,
                sameSite: "lax",
                path: "/",
                secure: process.env.NEXT_PUBLIC_ENV === "prod" || process.env.NODE_ENV === "production",
            },
        },
    },

    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: User }) {
            if (user) {
                (token as any).access_token = (user as any).token;
                (token as any).role = (user as any).role;
            }
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            (session as any).access_token = (token as any).access_token;
            (session as any).user = {
                ...session.user,
                role: (token as any).role,
            };
            return session;
        },
    },

    pages: { signIn: "/auth/signin" },
    secret: process.env.NEXTAUTH_SECRET,
};
