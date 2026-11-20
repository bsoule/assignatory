/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Sampled from the turkey icon (public/gobble.png); `sand` is its background.
      colors: {
        sand: '#FCC99F',
        cream: '#FFF5E9',
        ink: '#3C2E00',
        tomato: '#FF413D',
        leaf: '#5DCD72',
      },
      fontFamily: {
        sans: ['Fredoka', 'ui-rounded', 'system-ui', 'sans-serif'],
      },
      // A hard-edged "ground line" under things, like the one the turkey stands on.
      boxShadow: {
        ground: '0 3px 0 0 #3C2E00',
        'ground-sm': '0 2px 0 0 #3C2E00',
      },
    },
  },
  plugins: [],
}
