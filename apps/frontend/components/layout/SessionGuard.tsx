'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'

type SessionState =
  | { status: 'checking' }
  | { status: 'authenticated'; user: AuthMe }
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }

/**
 * Единая точка проверки сессии для (app)-сегмента. Серверный layout.tsx
 * проверяет только НАЛИЧИЕ cookie accessToken (без валидации), поэтому
 * просроченный/невалидный токен раньше пропускал пользователя в дашборд
 * с "битым" состоянием вместо чистого редиректа на /login.
 *
 * Правила:
 *  - пока сессия не проверена — показываем loader, детей не рендерим и
 *    редирект не делаем (redirect не должен выполняться, пока состояние
 *    сессии не определено);
 *  - 401/403 → невалидная сессия: чистим cookie и ведём на /login;
 *  - любая другая ошибка (сеть, 5xx) → понятный экран с "Повторить"/"Выйти",
 *    а не бесконечный loader и не пустой экран;
 *  - успех → рендерим children как обычно.
 */
export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<SessionState>({ status: 'checking' })

  const check = useCallback(async () => {
    setState({ status: 'checking' })
    try {
      const user = await me()
      setState({ status: 'authenticated', user })
    } catch (error: any) {
      const status = error?.status
      if (status === 401 || status === 403) {
        setState({ status: 'unauthenticated' })
        return
      }

      setState({ status: 'error', message: error?.message || 'Не удалось загрузить профиль' })
    }
  }, [])

  useEffect(() => {
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.status !== 'unauthenticated') return
    logoutLocal()
    router.replace('/login')
  }, [state.status, router])

  function handleLogout() {
    logoutLocal()
    router.replace('/login')
  }

  if (state.status === 'checking' || state.status === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b12]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-cyan-400" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050b12] p-4">
        <div className="w-full max-w-sm rounded-[24px] border border-white/10 bg-[#0b111c] p-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.55)]">
          <div className="text-base font-semibold text-white">Не удалось загрузить профиль</div>
          <div className="mt-2 text-sm text-zinc-400">{state.message}</div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={check}
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

  return <>{children}</>
}
