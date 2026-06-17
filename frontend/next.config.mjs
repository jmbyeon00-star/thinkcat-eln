// frontend/next.config.mjs
import path from "path";
import { fileURLToPath } from "url";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin(
  './i18n/request.ts'
);

// __dirname 대체 코드 (ESM용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NODE_ENV + NEXT_PUBLIC_ENV 둘 다 체크
const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_ENV === "prod";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 선행기술조사(invalidation) 등 장시간 LLM 작업이 rewrite 프록시 기본 타임아웃에 끊기지 않도록
  proxyTimeout: 600000,

  // ✅ App Router에서는 withNextIntl 플러그인이 i18n 설정을 관리하므로 삭제 가능하거나 최소화
  // i18n: {
  //   locales: ["ko", "en"],
  //   defaultLocale: "ko",
  // },

  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname);
    config.resolve.alias["@components"] = path.resolve(__dirname, "components");
    config.resolve.alias["@lib"] = path.resolve(__dirname, "lib");
    return config;
  },

  // 핵심: /api 프록시 (NextAuth는 제외)
  async rewrites() {
    /**
     * 우선순위:
     * 1) API_BASE_URL (서버 전용 env, 운영에서 추천)
     * 2) NEXT_PUBLIC_API_BASE_URL (개발에서 브라우저도 알아야 할 때 사용)
     * 3) docker 내부 기본값 (compose에서 service name이 backend라면 동작)
     */
    const backend =
      process.env.API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      "http://backend:8008";

    return [
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },

      {
        source: "/api/:path*",
        destination: `${backend}/api/:path*`,
      },
    ];
  },

  async headers() {
    if (isProd) {
      console.log("[Next.js Config] Running in PRODUCTION mode");
      return [
        {
          source: "/(.*)",
          headers: [
            { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
            { key: "X-Frame-Options", value: "DENY" },
            { key: "X-Content-Type-Options", value: "nosniff" },
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          ],
        },
      ];
    }

    console.log("[Next.js Config] Running in DEVELOPMENT mode");
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);