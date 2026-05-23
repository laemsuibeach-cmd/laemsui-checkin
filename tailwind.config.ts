import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
        },
        resort: {
          gold:  '#d4a853',
          teal:  '#0f766e',
          cream: '#fefce8',
        },
      },
      // iPad touch targets — minimum 44px
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
      fontSize: {
        // Larger for easier reading on iPad
        'ipad-sm': ['16px', '24px'],
        'ipad-base': ['18px', '28px'],
        'ipad-lg': ['20px', '30px'],
        'ipad-xl': ['24px', '32px'],
      },
    },
  },
  plugins: [],
}

export default config
