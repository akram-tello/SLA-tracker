/** @type {import('tailwindcss').Config} */
const { fontFamily } = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'var(--font-inter)',
          ...fontFamily.sans,
        ],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 