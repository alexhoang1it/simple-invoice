import type { Config } from 'tailwindcss';

/**
 * "Ledger" — the look is a paper invoice rather than a SaaS dashboard: warm
 * off-white stock, ink-black text, a burgundy accent for anything actionable,
 * and a serif for headings and figures the way a printed statement sets them.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: {
          DEFAULT: '#FBF8F3',
          raised: '#FFFDFA',
          sunk: '#F3EEE6',
          line: '#E4DCD0',
          edge: '#CFC4B4',
        },
        ink: {
          DEFAULT: '#1A1714',
          soft: '#4A433C',
          faint: '#7C736A',
        },
        claret: {
          DEFAULT: '#7A2231',
          hover: '#631B28',
          wash: '#F6E9EB',
        },
        brass: {
          DEFAULT: '#8A6415',
          wash: '#FBF1DC',
        },
        moss: {
          DEFAULT: '#2F5D3A',
          wash: '#E7F0E8',
        },
        slate: {
          DEFAULT: '#4A5257',
          wash: '#ECEEEF',
        },
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'Cambria', 'Times New Roman', 'serif'],
        mono: ['"JetBrains Mono"', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.06em' }],
      },
      boxShadow: {
        card: '0 1px 2px rgba(26, 23, 20, 0.05), 0 1px 12px rgba(26, 23, 20, 0.04)',
        lift: '0 10px 30px rgba(26, 23, 20, 0.12)',
      },
      borderRadius: {
        sheet: '2px',
      },
      gridTemplateColumns: {
        shell: '15rem minmax(0, 1fr)',
      },
    },
  },
  plugins: [],
} satisfies Config;
