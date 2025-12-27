/** @type {import('tailwindcss').Config} */
export default {
    darkMode: "class",
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Primary Blue
                primary: {
                    DEFAULT: '#2b7cee',
                    50: '#eff6ff',
                    100: '#dbeafe',
                    200: '#bfdbfe',
                    300: '#93c5fd',
                    400: '#60a5fa',
                    500: '#2b7cee',
                    600: '#2563eb',
                    700: '#1d4ed8',
                    800: '#1e40af',
                    900: '#1e3a8a',
                },
                // Accent Yellow (Construction)
                accent: {
                    DEFAULT: '#f4e225',
                    light: '#fac533',
                    dark: '#dcb900',
                },
                // Dark Theme
                'background-dark': '#101822',
                'surface-dark': '#192433',
                'border-dark': '#324867',
                'text-muted': '#92a9c9',
                // Light Theme
                'background-light': '#f6f7f8',
                'surface-light': '#ffffff',
                'border-light': '#e9e2ce',
                // Steel Blue (for text)
                'steel-blue': '#2C3E50',
            },
            fontFamily: {
                display: ['Space Grotesk', 'system-ui', 'sans-serif'],
                body: ['Noto Sans', 'Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'DEFAULT': '0.25rem',
                'lg': '0.5rem',
                'xl': '0.75rem',
                '2xl': '1rem',
            },
            animation: {
                'float': 'float 6s ease-in-out infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
            },
            keyframes: {
                float: {
                    '0%, 100%': { transform: 'translateY(0px)' },
                    '50%': { transform: 'translateY(-20px)' },
                },
                glow: {
                    '0%': { boxShadow: '0 0 20px rgba(43, 124, 238, 0.3)' },
                    '100%': { boxShadow: '0 0 40px rgba(43, 124, 238, 0.6)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            backgroundImage: {
                'grid-pattern': `
                    linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
                `,
            },
            backgroundSize: {
                'grid': '40px 40px',
            },
        },
    },
    plugins: [],
}
