/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'flux-black': '#0F0F10',
                'flux-dark': '#1C1C1E',
                'flux-light': '#F4F5F7',
                'flux-lime': '#D9F575',
                'flux-purple': '#C5C0F2',
                'flux-text': '#1C1C1E',
                'flux-text-dim': '#8E8E93',
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'], // Fallback if font load fails
            }
        },
    },
    plugins: [],
}
