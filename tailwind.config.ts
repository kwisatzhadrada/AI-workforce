import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08081C',
        bg2: '#0C0D22',
        s1: '#121428',
        s2: '#181A30',
        p: '#6D28D9',
        p2: '#8B5CF6',
        g: '#16A34A',
        g2: '#22C55E',
        r: '#DC2626',
        r2: '#EF4444',
        t1: '#EDEAF8',
        t2: '#8A88A8',
        t3: '#3C3A58',
      },
      fontFamily: {
        display: ['var(--font-space-grotesk)', 'sans-serif'],
        'space-grotesk': ['var(--font-space-grotesk)', 'sans-serif'],
        inter: ['var(--font-inter)', 'sans-serif'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
