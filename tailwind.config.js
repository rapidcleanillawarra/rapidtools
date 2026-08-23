/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'rapid-canvas': '#0e1012',
        'rapid-surface': '#141619',
        'rapid-panel': '#101214',
        'rapid-card': '#16191d',
        'rapid-card-hover': '#1f2329',
        'rapid-border': '#262a30',
        'rapid-border-light': '#333842'
      },
      fontFamily: {
        // You can add your custom fonts here
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography')
  ],
  darkMode: 'class', // Enable dark mode if needed
} 