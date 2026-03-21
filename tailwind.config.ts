import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#F0F4FF', deep: '#E8EDF8' },
        card: { DEFAULT: '#FFFFFF', alt: '#F8FAFF', muted: '#EEF2FC' },
        teal: { DEFAULT: '#0FBCCE', dim: 'rgba(15,188,206,0.10)', glow: 'rgba(15,188,206,0.25)' },
        aimee: {
          green: '#10B981',
          'green-dim': 'rgba(16,185,129,0.10)',
          indigo: '#4F7FFF',
          'indigo-dim': 'rgba(79,127,255,0.10)',
          amber: '#F59E0B',
          'amber-dim': 'rgba(245,158,11,0.12)',
          rose: '#F43F5E',
          'rose-dim': 'rgba(244,63,94,0.10)',
          purple: '#A855F7',
          'purple-dim': 'rgba(168,85,247,0.10)',
        },
        txt: { DEFAULT: '#0D1117', secondary: '#4A5A7A', muted: '#8B9CC8' },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      borderRadius: {
        aimee: '16px',
        'aimee-sm': '10px',
        'aimee-xs': '6px',
      },
      animation: {
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease both',
        'slide-up': 'slideUp 0.3s ease both',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
};

export default config;
