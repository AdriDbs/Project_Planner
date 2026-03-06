/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bp: {
          primary: '#003057',
          secondary: '#00A3E0',
          accent: '#FF6200',
          success: '#00B050',
          warning: '#FFC000',
          danger: '#FF0000',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

