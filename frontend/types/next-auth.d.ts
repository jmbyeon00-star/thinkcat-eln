// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
    interface Session {
        access_token?: string;
        user: {
            id?: string;
            role?: string;
        } & DefaultSession["user"];
    }

    interface User {
        role?: string;
        token?: string;
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        access_token?: string;
        role?: string;
    }
}