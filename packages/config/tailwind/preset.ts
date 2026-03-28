import type { Config } from 'tailwindcss'

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        background: '#0B0D10',
        panel: '#12151B',
        panelSoft: '#161A22',
        borderSoft: 'rgba(255,255,255,0.08)',
        textPrimary: '#E6EAF2',
        textMuted: '#9AA4B2',
        accent: '#7C8CFF'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.25)'
      },
      borderRadius: {
        xl2: '1rem'
      }
    }
  }
}

export default preset
