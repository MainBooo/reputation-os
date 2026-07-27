'use client'

import { useEffect } from 'react'

// Крайняя граница — ловит ошибки, до которых не достал ни один вложенный
// error.tsx (включая сбой самого корневого layout). Раньше такая ошибка
// оставляла пустой фон без интерфейса и текста — теперь всегда есть
// понятный экран с кнопкой повтора.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('global-error boundary caught', error)
  }, [error])

  return (
    <html lang="ru">
      <body style={{ background: '#050b12', color: '#fff', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              maxWidth: 380,
              width: '100%',
              textAlign: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              padding: 24,
              background: '#0b111c',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 600 }}>Что-то пошло не так</div>
            <div style={{ marginTop: 8, fontSize: 14, color: '#a1a1aa' }}>
              Попробуйте обновить страницу. Если ошибка повторяется, войдите заново.
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  flex: 1,
                  borderRadius: 16,
                  border: '1px solid rgba(34,211,238,0.2)',
                  background: 'rgba(34,211,238,0.15)',
                  color: '#fff',
                  padding: '12px 0',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Повторить
              </button>
              <a
                href="/login"
                style={{
                  flex: 1,
                  borderRadius: 16,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#a1a1aa',
                  padding: '12px 0',
                  fontSize: 14,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Войти заново
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
