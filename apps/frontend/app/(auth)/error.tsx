'use client'

import { useEffect } from 'react'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('(auth) error boundary caught', error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0b111c] p-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
        <div className="text-base font-semibold text-white">Не удалось загрузить страницу входа</div>
        <div className="mt-2 text-sm text-zinc-400">Попробуйте обновить страницу.</div>
        <button
          type="button"
          onClick={reset}
          className="mt-6 w-full rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] py-3 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Повторить
        </button>
      </div>
    </div>
  )
}
