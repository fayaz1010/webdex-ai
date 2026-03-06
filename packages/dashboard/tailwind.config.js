/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        webdex: { bg: '#080c14', card: '#0d1520', border: '#1a2535', green: '#10b981', purple: '#8b5cf6', amber: '#f59e0b', cyan: '#06b6d4', pink: '#ec4899', red: '#e85c5c' },
      },
    },
  },
  plugins: [],
};
