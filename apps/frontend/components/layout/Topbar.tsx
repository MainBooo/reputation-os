'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  LogOut,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Menu
} from 'lucide-react'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'
import { apiFetch } from '@/lib/api/client'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { useChatContext } from '@/lib/chat/ChatContext'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { getPlanBadgeLabel, isSubscriptionActive } from '@/lib/api/billing'
import { useMobileDrawer } from '@/lib/layout/MobileDrawerContext'
import NotificationsBell from './NotificationsBell'
import ChatButton from '@/components/chat/ChatButton'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import HelpCenterDrawer from '@/components/help/HelpCenterDrawer'
import { HelpCircle } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Панель' },
  { href: '/companies', label: 'Компании' },
  { href: '/team', label: 'Команда' },
  { href: '/settings', label: 'Настройки' }
]

export default function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const { setWorkspaceId } = useChatContext()
  const { entitlements } = useSubscription()
  const planLabel = getPlanBadgeLabel(entitlements)
  const planActive = isSubscriptionActive(entitlements)
  const { openDrawer } = useMobileDrawer()

  const visibleNavItems = user?.systemRole === 'SUPER_ADMIN'
    ? [...navItems, { href: '/admin', label: 'Админка' }]
    : navItems

  const currentSection = visibleNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const pageTitle = currentSection?.label ?? 'Reputation OS'

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const data = await me()
        if (mounted) setUser(data)

        // Initialize workspace ID for chat — always validate against actual membership
        const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
        if (stored) setWorkspaceId(stored) // optimistic set from cache
        const workspaces = await apiFetch<{ id: string }[]>('/workspaces', undefined, [])
        const validId = Array.isArray(workspaces) && workspaces.length
          ? (workspaces.find((w) => w.id === stored)?.id ?? workspaces[0].id)
          : stored ?? ''
        if (validId) {
          if (validId !== stored) localStorage.setItem(WORKSPACE_STORAGE_KEY, validId)
          if (mounted) setWorkspaceId(validId)
        }
      } catch {
        if (mounted) setUser(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleLogout() {
    logoutLocal()
    setUser(null)
    router.push('/login')
    router.refresh()
  }

  return (
    <>
    <header className="sticky top-0 z-30 print:hidden border-b border-cyan-300/10 bg-[#050d18]/78 shadow-[0_18px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(59,130,246,0.26),transparent_38%),radial-gradient(circle_at_78%_10%,rgba(139,92,246,0.14),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

      <div className="relative px-4 py-4 sm:px-5 lg:px-8">
        <div className="rounded-[34px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_52px_rgba(59,130,246,0.12)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={openDrawer}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-200 transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.09] hover:text-white active:scale-[0.97] lg:hidden"
                aria-label="Открыть меню"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.36em] text-blue-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Workspace
                </div>
                <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[36px]">
                  {pageTitle}
                </div>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center gap-3 xl:justify-end">
              <div
                className={clsx(
                  'inline-flex min-w-0 max-w-full items-center gap-3 rounded-[22px] border px-4 py-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
                  user
                    ? 'border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-100 shadow-[0_0_30px_rgba(59,130,246,0.16)]'
                    : 'border-amber-400/25 bg-amber-400/[0.10] text-amber-100'
                )}
              >
                {user ? <ShieldCheck className="h-5 w-5 shrink-0" /> : <ShieldAlert className="h-5 w-5 shrink-0" />}
                <span className="truncate">
                  {loading ? 'Проверка...' : user ? (user.email || 'Выполнен вход') : 'Гость'}
                </span>
                {user ? (
                  <span className="hidden items-center gap-1.5 text-cyan-200 sm:inline-flex">
                    <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(110,231,183,0.9)]" />
                    Онлайн
                  </span>
                ) : null}
              </div>

              {user ? <WorkspaceSwitcher /> : null}

              {user ? (
                <button
                  type="button"
                  onClick={() => router.push('/billing/checkout')}
                  className={clsx(
                    'inline-flex shrink-0 items-center rounded-[18px] border px-3 py-2 text-xs font-semibold transition',
                    planActive
                      ? 'border-cyan-400/25 bg-cyan-500/[0.10] text-cyan-200 hover:bg-cyan-500/[0.18]'
                      : 'border-amber-400/20 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.14]'
                  )}
                  title="Перейти к выбору тарифа"
                >
                  {planLabel}
                </button>
              ) : null}
              {user ? (
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-[18px] border border-white/10 bg-white/[0.05] px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.09] hover:text-white active:scale-[0.97]"
                  title="Помощь и руководство"
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Помощь</span>
                </button>
              ) : null}
              {user ? <ChatButton /> : null}
              {user ? <NotificationsBell /> : null}

              {user ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex shrink-0 items-center gap-3 rounded-[22px] border border-violet-400/20 bg-violet-500/[0.08] px-4 py-3 text-sm text-slate-100 shadow-[0_0_28px_rgba(139,92,246,0.12)] transition hover:border-violet-300/35 hover:bg-violet-500/[0.14] hover:text-white"
                >
                  <LogOut className="h-5 w-5" />
                  Выйти
                </button>
              ) : (
                <Link
                  href="/login"
                  className="inline-flex shrink-0 items-center rounded-[22px] border border-violet-400/40 bg-cyan-500/[0.08] px-4 py-3 text-sm text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-500/[0.14] hover:text-white"
                >
                  Войти
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>

    <HelpCenterDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
  </>
  )
}
