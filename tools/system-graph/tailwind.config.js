/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#090d16',
        surface: '#0f172a',
        'surface-hover': '#1e293b',
        border: 'rgba(255, 255, 255, 0.08)',
        primary: {
          DEFAULT: '#6366f1',
          foreground: '#ffffff',
        },
      },
    },
  },
  plugins: [],
};
