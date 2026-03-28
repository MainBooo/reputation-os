import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0B0D10',
        panel: '#12161C',
        panel2: '#171C24',
        line: 'rgba(255,255,255,0.08)',
        muted: '#96A0AE',
        brand: '#E7EDF7'
      },
      boxShadow: {
        panel: '0 10px 30px rgba(0,0,0,0.25)'
      }
    }
  },
  plugins: []
}

export default config
