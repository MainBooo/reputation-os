'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import { LogOut, ShieldCheck, ShieldAlert, LayoutDashboard, Building2, Settings } from 'lucide-react'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'

const navItems = [
  { href: '/dashboard', label: 'Панель', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

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
    <header className="sticky top-0 z-20 overflow-x-hidden border-b border-white/10 bg-[#071019]/70 backdrop-blur-2xl">
      <div className="flex min-h-16 flex-col gap-3 px-4 py-3 sm:px-5 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/70">Workspace</div>
            <div className="mt-1 truncate text-sm font-medium text-white">Reputation OS</div>
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-end">
            <div
              className={
                user
                  ? 'inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-100'
                  : 'inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100'
              }
            >
              {user ? <ShieldCheck size={14} className="shrink-0" /> : <ShieldAlert size={14} className="shrink-0" />}
              <span className="truncate">
                {loading ? 'Проверка...' : user ? (user.email || 'Выполнен вход') : 'Гость'}
              </span>
            </div>

            {user ? (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.08] hover:text-white"
              >
                <LogOut size={14} />
                Выйти
              </button>
            ) : (
              <Link
                href="/login"
                className="inline-flex shrink-0 items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.08] hover:text-white"
              >
                Войти
              </Link>
            )}
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')

            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-all',
                  active
                    ? 'border-cyan-400/20 bg-cyan-400/[0.14] text-white shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </header>
  )
}
