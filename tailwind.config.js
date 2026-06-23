/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'monospace'],
      },
      colors: {
        rpg: {
          bg: '#0f0f1a',
          panel: '#1a1a2e',
          border: '#2d2d44',
          accent: '#7c3aed',
          gold: '#f59e0b',
          green: '#10b981',
          red: '#ef4444',
          blue: '#3b82f6',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
}
