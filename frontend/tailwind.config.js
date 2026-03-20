/* @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
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
                    600: "#0A5FFF",
                    700: "#084fcc",
                    800: "#063d99",
                    900: "#042a66"
                },
                brand2: {
                    DEFAULT: "#1F5EBB",
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