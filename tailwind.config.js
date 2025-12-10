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
    extend: {},
  },
  plugins: [],
}
