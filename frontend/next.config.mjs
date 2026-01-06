// frontend/next.config.mjs
import path from "path";
import { fileURLToPath } from "url";

// __dirname 대체 코드 (ESM용)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// NODE_ENV + NEXT_PUBLIC_ENV 둘 다 체크
const isProd =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_ENV === "prod";

/* @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // ✅ i18n 설정 (Pages Router)
  i18n: {
    locales: ["ko", "en"],
    defaultLocale: "ko",
  },

  experimental: {
    allowedDevOrigins: ["http://192.168.1.20:3000", "http://localhost:3000"],
  },

  webpack: (config) => {
    config.resolve.alias["@"] = path.resolve(__dirname);
    config.resolve.alias["@components"] = path.resolve(__dirname, "components");
    config.resolve.alias["@lib"] = path.resolve(__dirname, "lib");
    return config;
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
            { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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

export default nextConfig;
