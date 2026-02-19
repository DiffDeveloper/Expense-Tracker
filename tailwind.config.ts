import forms from '@tailwindcss/forms'
import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/app.vue',
    './server/**/*.{ts,js}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff6ed',
          100: '#ffe9d3',
          200: '#ffd0a6',
          300: '#ffb070',
          400: '#ff8f3b',
          500: '#ff7a00',
          600: '#e35e00',
          700: '#bc4700',
          800: '#963a08',
          900: '#7a310b'
        }
      },
      fontFamily: {
        heading: ['Space Grotesk', 'Trebuchet MS', 'sans-serif'],
        body: ['Manrope', 'Segoe UI', 'sans-serif']
      },
      boxShadow: {
        glow: '0 18px 50px rgba(255, 122, 0, 0.25)'
      }
    }
  },
  plugins: [forms]
} satisfies Config
