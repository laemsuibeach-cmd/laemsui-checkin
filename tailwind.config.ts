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
        brand: {
          red:       '#C8372D',
          'red-dark':'#a82b23',
          'red-light':'#e04038',
        },
      },
      // iPad touch targets — minimum 44px
      minHeight: { touch: '44px' },
      minWidth:  { touch: '44px' },
      fontSize: {
        // rem-based so they scale with html font-size (17–19px on tablet/notebook)
        'ipad-sm':   ['1rem',     { lineHeight: '1.5rem' }],   // ~16 → 18 → 19px
        'ipad-base': ['1.125rem', { lineHeight: '1.75rem' }],  // ~18 → 20 → 21px
        'ipad-lg':   ['1.25rem',  { lineHeight: '1.875rem' }], // ~20 → 22 → 24px
        'ipad-xl':   ['1.5rem',   { lineHeight: '2rem' }],     // ~24 → 27 → 28px
        'ipad-2xl':  ['1.75rem',  { lineHeight: '2.25rem' }],  // ~28 → 31 → 33px
      },
    },
  },
  plugins: [],
}

export default config
