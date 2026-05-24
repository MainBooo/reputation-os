'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ArrowUp, Building2, LayoutDashboard, Menu, Settings, Shield, Users, X } from 'lucide-react'
import { me, type AuthMe } from '@/lib/api/auth'
import { getWorkspaces } from '@/lib/api/companies'
import SidebarTasksCard from './SidebarTasksCard'

const baseItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export default function MobileSidebarDrawer() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<AuthMe | null>(null)
  const [canManageTeam, setCanManageTeam] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadAccess() {
      try {
        const [userData, workspaces] = await Promise.all([me(), getWorkspaces()])
        if (!mounted) return

        setUser(userData)

        const list = Array.isArray(workspaces) ? workspaces : []
        const allowed = list.some((workspace: any) =>
          Array.isArray(workspace?.members) &&
          workspace.members.some((member: any) =>
            member?.userId === userData.id && ['OWNER', 'ADMIN'].includes(member?.role)
          )
        )

        setCanManageTeam(allowed)
      } catch {}
    }

    loadAccess()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const items = useMemo(() => {
    const nextItems = canManageTeam
      ? [...baseItems, { href: '/team', label: 'Команда', icon: Users }]
      : baseItems

    if (user?.systemRole !== 'SUPER_ADMIN') return nextItems
    return [...nextItems, { href: '/admin', label: 'Админка', icon: Shield }]
  }, [canManageTeam, user?.systemRole])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={clsx(
          'fixed right-4 z-50 inline-flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/20 bg-[#07111f]/92 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.20)] backdrop-blur-2xl transition-all duration-300 lg:hidden',
          open ? 'bottom-6 opacity-0 pointer-events-none scale-95' : 'bottom-[104px] opacity-100 scale-100'
        )}
        aria-label="Открыть меню"
      >
        <Menu className="h-7 w-7" />
      </button>

        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className={clsx(
            'fixed right-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#07111f]/88 text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.16)] backdrop-blur-2xl transition-all duration-300 lg:hidden',
            open ? 'bottom-6 opacity-0 pointer-events-none scale-95' : 'bottom-[176px] opacity-100 scale-100'
          )}
          aria-label="Наверх"
        >
          <ArrowUp className="h-5 w-5" />
        </button>

      <div
        className={clsx(
          'fixed inset-0 z-[70] lg:hidden transition-all duration-300',
          open ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <button
          type="button"
          aria-label="Закрыть меню"
          className={clsx(
            'absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300',
            open ? 'opacity-100' : 'opacity-0'
          )}
          onClick={() => setOpen(false)}
        />

        <aside
          className={clsx(
            'relative h-full w-[86vw] max-w-[360px] overflow-y-auto border-r border-cyan-300/10 bg-[#06101b]/98 p-5 shadow-[0_0_80px_rgba(34,211,238,0.12)] transition-transform duration-300 ease-out',
            open ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em] text-blue-100/70">Reputation OS</div>
              <div className="mt-2 text-xl font-semibold text-white">Reputation Inbox</div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 rounded-[26px] border border-cyan-400/15 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.12),transparent_38%),rgba(255,255,255,0.035)] p-5 text-sm leading-6 text-slate-300">
            Центр мониторинга отзывов, упоминаний и репутационной аналитики.
          </div>

          <nav className="mt-6 space-y-3">
            {items.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={clsx(
                    'group flex items-center gap-3 rounded-[20px] border px-4 py-3.5 text-sm transition-all duration-200',
                    active
                      ? 'border-cyan-400/40 bg-cyan-400/[0.14] text-white shadow-[0_0_34px_rgba(34,211,238,0.24)]'
                      : 'border-white/8 bg-white/[0.025] text-slate-300 hover:border-violet-400/40 hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  <span className={clsx(
                    'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                    active
                      ? 'border-blue-300/30 bg-cyan-300/10 text-blue-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-400 group-hover:text-blue-100'
                  )}>
                    <Icon size={17} />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <SidebarTasksCard />
        </aside>
      </div>
    </>
  )
}
