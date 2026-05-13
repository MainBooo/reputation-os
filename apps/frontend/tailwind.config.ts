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
        bg: '#02030B',
        panel: '#070A18',
        panel2: '#0B1024',
        line: 'rgba(96,165,250,0.18)',
        muted: '#A7B0C4',
        brand: '#F6F8FF'
      },
      boxShadow: {
        panel: '0 24px 90px rgba(0,0,0,0.46), 0 0 44px rgba(37,99,235,0.12), inset 0 1px 0 rgba(255,255,255,0.06)'
      }
    }
  },
  plugins: []
}

export default config
