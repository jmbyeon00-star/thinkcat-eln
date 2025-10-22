import NextAuth, { type AuthOptions } from "next-auth";
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
            async authorize(credentials) {
                // const res = await fetch(`http://192.168.1.20:8000/api/auth/login`, {
                const res = await fetch(`${process.env.BACKEND_URL}/api/auth/login`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: credentials?.username,
                        password: credentials?.password,
                    }),
                });

                const data = await res.json().catch(() => null);
                if (!res.ok || !data?.ok) return null;

                const user = {
                    id: data.user.id,
                    name: data.user.name,
                    email: data.user.email,
                    token: data.access_token,
                } as User;

                return user;
            },
        }),
    ],

    session: { strategy: "jwt" },

    callbacks: {
        async jwt({ token, user }: { token: JWT; user?: User }) {
            if (user) (token as any).access_token = (user as any).token;
            return token;
        },
        async session({ session, token }: { session: Session; token: JWT }) {
            (session as any).access_token = (token as any).access_token;
            return session;
        },
    },

    // ✅ 오타 수정
    pages: { signIn: "/auth/signin" },
    secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
