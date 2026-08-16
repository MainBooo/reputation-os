'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logoutLocal } from '@/lib/api/auth'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('(app) error boundary caught', error)
  }, [error])

  function handleLogout() {
    logoutLocal()
    router.replace('/login')
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0b111c] p-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
        <div className="text-base font-semibold text-white">Не удалось загрузить страницу</div>
        <div className="mt-2 text-sm text-zinc-400">
          Попробуйте ещё раз. Если ошибка повторяется, выйдите и войдите заново.
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-2xl border border-cyan-300/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.34),rgba(79,70,229,0.34),rgba(168,85,247,0.28))] py-3 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Повторить
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex-1 rounded-2xl border border-white/10 bg-white/[0.05] py-3 text-sm font-medium text-zinc-400 transition hover:bg-white/[0.09] hover:text-white"
          >
            Выйти
          </button>
        </div>
      </div>
    </div>
  )
}
