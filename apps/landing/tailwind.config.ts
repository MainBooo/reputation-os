import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink: '#050914',
        panel: '#0B1220',
        cyanGlow: '#22D3EE',
        turquoise: '#2DD4BF'
      },
      boxShadow: {
        glow: '0 0 40px rgba(34, 211, 238, 0.16)'
      }
    }
  },
  plugins: []
}

export default config
