// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        access_token?: string;
        user: {
            id?: string;
        } & DefaultSession["user"];
    }

    interface User {
        token?: string; // authorize에서 리턴한 token 필드 대응
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        access_token?: string;
    }
}