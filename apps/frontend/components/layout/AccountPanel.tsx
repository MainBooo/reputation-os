'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import { HelpCircle, LogOut, ShieldAlert, ShieldCheck } from 'lucide-react'
import { me, logoutLocal, type AuthMe } from '@/lib/api/auth'
import { useSubscription } from '@/lib/subscription/SubscriptionContext'
import { getPlanBadgeLabel, isSubscriptionActive } from '@/lib/api/billing'
import NotificationsBell from './NotificationsBell'
import ChatButton from '@/components/chat/ChatButton'
import WorkspaceSwitcher from './WorkspaceSwitcher'
import HelpCenterDrawer from '@/components/help/HelpCenterDrawer'

export default function AccountPanel({
  onNavigate,
  dropdownAlign = 'down'
}: {
  onNavigate?: () => void
  dropdownAlign?: 'up' | 'down'
}) {
  const router = useRouter()
  const [user, setUser] = useState<AuthMe | null>(null)
  const [loading, setLoading] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const { entitlements } = useSubscription()
  const planLabel = getPlanBadgeLabel(entitlements)
  const planActive = isSubscriptionActive(entitlements)

  useEffect(() => {
    let mounted = true
    me()
      .then((data) => { if (mounted) setUser(data) })
      .catch(() => { if (mounted) setUser(null) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => {
      mounted = false
    }
  }, [])

  function handleLogout() {
    logoutLocal()
    setUser(null)
    onNavigate?.()
    router.push('/login')
    router.refresh()
  }

  function handleBilling() {
    onNavigate?.()
    router.push('/billing/checkout')
  }

  return (
    <div className="space-y-3">
      <div
        className={clsx(
          'flex min-w-0 items-center gap-2.5 rounded-[16px] border px-3.5 py-2.5 text-sm',
          user
            ? 'border-emerald-400/25 bg-emerald-400/[0.10] text-emerald-100'
            : 'border-amber-400/25 bg-amber-400/[0.10] text-amber-100'
        )}
      >
        {user ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
        <span className="truncate text-xs">
          {loading ? 'Проверка...' : user ? (user.email || 'Выполнен вход') : 'Гость'}
        </span>
      </div>

      {user ? (
        <>
          <WorkspaceSwitcher dropdownAlign={dropdownAlign} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleBilling}
              className={clsx(
                'inline-flex h-12 flex-1 items-center justify-center rounded-[16px] border px-3 text-xs font-semibold transition',
                planActive
                  ? 'border-cyan-400/25 bg-cyan-500/[0.10] text-cyan-200 hover:bg-cyan-500/[0.18]'
                  : 'border-amber-400/20 bg-amber-500/[0.08] text-amber-200 hover:bg-amber-500/[0.14]'
              )}
              title="Перейти к выбору тарифа"
            >
              {planLabel}
            </button>

            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Помощь и руководство"
              title="Помощь и руководство"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/10 bg-white/[0.05] text-slate-300 transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.09] hover:text-white"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            <ChatButton />
            <NotificationsBell dropdownAlign={dropdownAlign} />
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-[16px] border border-violet-400/20 bg-violet-500/[0.06] px-4 py-2.5 text-sm text-slate-200 transition hover:border-violet-300/35 hover:bg-violet-500/[0.12] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </>
      ) : (
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-[16px] border border-violet-400/40 bg-cyan-500/[0.08] px-4 py-2.5 text-sm text-slate-100 transition hover:border-cyan-300/35 hover:bg-cyan-500/[0.14] hover:text-white"
        >
          Войти
        </Link>
      )}

      <HelpCenterDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
