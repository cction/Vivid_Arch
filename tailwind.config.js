/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './index.{ts,tsx,js,jsx}',
    './App.{ts,tsx,js,jsx}',
    './components/**/*.{ts,tsx,js,jsx}',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'text-shimmer': {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        }
      },
      animation: {
        shimmer: 'shimmer 1s ease-in-out',
        'text-shimmer': 'text-shimmer 1s ease-in-out',
      }
    },
  },
  plugins: [],
}
