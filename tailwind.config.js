/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bone: '#FAFAF7',
        cream: '#F2EDE3',
        sand: '#E8E2D3',
        ink: '#0A0A0A',
        electric: '#2D6BE4',
        navy: '#1B2D6B',
        clay: '#C85A3F',
        ember: '#E07A5F',
        ash: {
          50: '#F4F4F0',
          100: '#E9E9E3',
          200: '#D6D6CE',
          300: '#B6B6AC',
          400: '#8A8A82',
          500: '#5A5A55',
          600: '#3A3A36',
          700: '#222220',
        },
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'ui-serif', 'Georgia', 'serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
