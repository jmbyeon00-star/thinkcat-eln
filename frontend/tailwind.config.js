/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"], // 다크모드는 class로 토글
    content: [
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: "#eef5ff",
                    100: "#dbe9ff",
                    200: "#b7d2ff",
                    300: "#93bcff",
                    400: "#6ea5ff",
                    500: "#4a8fff",
                    600: "#0A5FFF",   // ← IPFORCE 핵심 블루(예시)
                    700: "#084fcc",
                    800: "#063d99",
                    900: "#042a66"
                },
                brand2: {
                    DEFAULT: "#1F5EBB", // IPFORCE 파랑
                    light: "#3F7FE0",
                    dark: "#154A9A"
                }
            }
        }
    },
    plugins: [
        require('@tailwindcss/typography'),
    ],
}