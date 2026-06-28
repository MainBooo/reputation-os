'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import clsx from 'clsx'
import {
  LogOut,
  ShieldCheck,
  ShieldAlert,
  LayoutDashboard,
  Building2,
  UsersRound,
  Settings,
  Sparkles,
  Radio
} from 'lucide-react'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'
import { apiFetch } from '@/lib/api/client'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { useChatContext } from '@/lib/chat/ChatContext'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { getPlanBadgeLabel, isSubscriptionActive } from '@/lib/api/billing'
import NotificationsBell from './NotificationsBell'
import ChatButton from '@/components/chat/ChatButton'

const navItems = [
  {
    href: '/dashboard',
    label: 'Панель',
    description: 'Обзор и метрики',
    icon: LayoutDashboard,
    tone: 'cyan'
  },
  {
    href: '/companies',
    label: 'Компании',
    description: 'Управление',
    icon: Building2,
    tone: 'violet'
  },
  {
    href: '/team',
    label: 'Команда',
    description: 'Доступы',
    icon: UsersRound,
    tone: 'cyan'
  },
  {
    href: '/settings',
    label: 'Настройки',
    description: 'Система',
    icon: Settings,
    tone: 'emerald'
  }
]

function navTone(tone: string, active: boolean) {
  if (tone === 'violet') {
    return active
      ? 'border-violet-400/40 bg-violet-500/[0.16] shadow-[0_0_34px_rgba(139,92,246,0.24)]'
      : 'border-violet-400/15 bg-violet-500/[0.055] hover:border-violet-400/30 hover:bg-violet-500/[0.10]'
  }

  if (tone === 'emerald') {
    return active
      ? 'border-emerald-400/40 bg-emerald-500/[0.16] shadow-[0_0_34px_rgba(99,102,241,0.34)]'
      : 'border-emerald-400/15 bg-emerald-500/[0.055] hover:border-blue-400/35 hover:bg-emerald-500/[0.10]'
  }

  return active
    ? 'border-cyan-400/45 bg-cyan-500/[0.18] shadow-[0_0_38px_rgba(34,211,238,0.28)]'
    : 'border-cyan-400/15 bg-cyan-500/[0.055] hover:border-cyan-400/30 hover:bg-cyan-500/[0.10]'
}

function iconTone(tone: string, active: boolean) {
  if (tone === 'violet') return active ? 'border-violet-300/35 bg-violet-300/15 text-violet-100' : 'border-violet-300/15 bg-white/[0.04] text-violet-200'
  if (tone === 'emerald') return active ? 'border-emerald-300/35 bg-cyan-300/15 text-emerald-100' : 'border-emerald-300/15 bg-white/[0.04] text-cyan-100'
  return active ? 'border-cyan-300/35 bg-cyan-300/15 text-blue-100' : 'border-cyan-300/15 bg-white/[0.04] text-blue-100'
}

export default function Topbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)
  const { setWorkspaceId } = useChatContext()
  const { entitlements } = useSubscription()
  const planLabel = getPlanBadgeLabel(entitlements)
  const planActive = isSubscriptionActive(entitlements)

  const visibleNavItems = user?.systemRole === 'SUPER_ADMIN'
    ? [
        ...navItems,
        {
          href: '/admin',
          label: 'Админка',
          description: 'Платформа',
          icon: ShieldCheck,
          tone: 'cyan'
        }
      ]
    : navItems

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
    <header className="sticky top-0 z-30 print:hidden border-b border-cyan-300/10 bg-[#050d18]/78 shadow-[0_18px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_0%,rgba(59,130,246,0.26),transparent_38%),radial-gradient(circle_at_78%_10%,rgba(139,92,246,0.14),transparent_32%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent" />

      <div className="relative px-4 py-4 sm:px-5 lg:px-8">
        <div className="rounded-[34px] border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_0_52px_rgba(59,130,246,0.12)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.36em] text-blue-100">
                <Sparkles className="h-3.5 w-3.5" />
                Workspace
              </div>
              <div className="mt-2 truncate text-[30px] font-semibold leading-none tracking-[-0.055em] text-white sm:text-[36px]">
                Reputation OS
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

          <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3 xl:grid-cols-5">
            {visibleNavItems.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'group relative overflow-hidden rounded-[20px] border px-2.5 py-3 transition-all duration-200 hover:-translate-y-0.5 sm:rounded-[28px] sm:p-4',
                    navTone(item.tone, active)
                  )}
                >
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.10),transparent_42%)] opacity-80" />
                  <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-50" />

                  <div className="relative flex flex-col items-center justify-center gap-2 text-center sm:flex-row sm:justify-start sm:gap-4 sm:text-left">
                    <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border transition sm:h-14 sm:w-14 sm:rounded-[22px]', iconTone(item.tone, active))}>
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-semibold tracking-[-0.035em] text-white sm:text-[19px]">
                        {item.label}
                      </span>
                      <span className="mt-1 hidden truncate text-sm text-slate-400 md:block">
                        {item.description}
                      </span>
                    </span>

                    {active ? (
                      <Radio className="ml-auto hidden h-4 w-4 shrink-0 text-blue-100 sm:block" />
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </header>
  )
}
