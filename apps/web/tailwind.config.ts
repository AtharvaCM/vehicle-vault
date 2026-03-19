import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0f172a',
        mist: '#e2e8f0',
        glow: '#22c55e',
        ember: '#fb923c',
      },
      backgroundImage: {
        'hero-radial':
          'radial-gradient(circle at top, rgba(34, 197, 94, 0.22), transparent 35%), radial-gradient(circle at 85% 20%, rgba(251, 146, 60, 0.16), transparent 24%)',
      },
      boxShadow: {
        panel: '0 24px 60px rgba(15, 23, 42, 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
