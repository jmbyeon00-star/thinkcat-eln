import { Inter } from "next/font/google";
import { getMessages } from "next-intl/server";
import { Providers } from "@/components/providers/Providers";
import { routing } from "@/routing";
import "@/styles/globals.css";

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
    title: "ThinkCat ELN",
    description: "ThinkCat AI 기반 R&D 솔루션",
    keywords: "특허, AI, IP, R&D, ThinkCat, 씽크캣",
    authors: [{ name: "ThinkCat" }],
    icons: {
        icon: "/favicon.ico",
    },
};

export default async function RootLayout({
    children,
    params: { locale }
}: {
    children: React.ReactNode;
    params: { locale: string };
}) {
    const messages = await getMessages();

    return (
        <html lang={locale}>
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            </head>
            <body className={inter.className}>
                <Providers messages={messages} locale={locale}>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
