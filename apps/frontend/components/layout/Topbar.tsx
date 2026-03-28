'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, ShieldCheck, ShieldAlert } from 'lucide-react'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'

export default function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await me()
        if (mounted) setUser(data)
      } catch {
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [pathname])

  function handleLogout() {
    logoutLocal()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-[#071019]/70 backdrop-blur-2xl">
      <div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 lg:px-8">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Workspace</div>
          <div className="mt-1 text-sm font-medium text-white">Reputation OS</div>
        </div>

        <div className="flex items-center gap-3">
          <div className={user
            ? 'inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100'
            : 'inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100'
          }>
            {user ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {loading ? 'Проверка...' : user ? (user.email || 'Выполнен вход') : 'Гость'}
          </div>

          {user ? (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.08] hover:text-white"
            >
              <LogOut size={14} />
              Выйти
            </button>
          ) : (
            <Link
              href="/login"
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.08] hover:text-white"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
