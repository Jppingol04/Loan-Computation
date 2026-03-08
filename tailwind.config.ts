import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Inter', 'sans-serif'],
        code: ['Source Code Pro', 'monospace'],
      },
      colors: {
        background: 'hsl(222, 47%, 6%)', // #0B1120
        foreground: 'hsl(210, 40%, 98%)',
        card: {
          DEFAULT: 'hsl(217, 33%, 11%)', // #111827
          foreground: 'hsl(210, 40%, 98%)',
        },
        popover: {
          DEFAULT: 'hsl(217, 33%, 11%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        primary: {
          DEFAULT: 'hsl(217, 91%, 60%)', // #3B82F6
          foreground: 'hsl(210, 40%, 98%)',
        },
        secondary: {
          DEFAULT: 'hsl(217, 19%, 27%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        muted: {
          DEFAULT: 'hsl(217, 19%, 15%)',
          foreground: 'hsl(215, 20%, 65%)',
        },
        accent: {
          DEFAULT: 'hsl(217, 91%, 60%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        destructive: {
          DEFAULT: 'hsl(0, 62.8%, 30.6%)',
          foreground: 'hsl(210, 40%, 98%)',
        },
        border: 'hsl(217, 19%, 27%)',
        input: 'hsl(217, 19%, 27%)',
        ring: 'hsl(217, 91%, 60%)',
        sidebar: {
          DEFAULT: 'hsl(222, 47%, 6%)',
          foreground: 'hsl(215, 20%, 65%)',
          primary: 'hsl(217, 91%, 60%)',
          'primary-foreground': 'hsl(210, 40%, 98%)',
          accent: 'hsl(217, 19%, 15%)',
          'accent-foreground': 'hsl(210, 40%, 98%)',
          border: 'hsl(217, 19%, 27%)',
          ring: 'hsl(217, 91%, 60%)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
