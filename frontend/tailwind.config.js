/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.97)' },
          to:   { opacity: '1', transform: 'translateY(0)     scale(1)'   },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to:   { opacity: '1', transform: 'translateX(0)'     },
        },
      },
      animation: {
        'fade-in':  'fadeIn 0.2s ease-out forwards',
        'slide-in': 'slideIn 0.25s ease-out forwards',
      },
    },
  },
  plugins: [],
}
