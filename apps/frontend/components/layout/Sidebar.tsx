'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutDashboard, Building2, Settings, Shield, Users } from 'lucide-react'
import SidebarTasksCard from './SidebarTasksCard'
import { me, type AuthMe } from '@/lib/api/auth'
import { getWorkspaces } from '@/lib/api/companies'

const baseItems = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export default function Sidebar() {
  const pathname = usePathname()
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
        // All workspace members (including MEMBER role) can view /team
        const allowed = list.some((workspace: any) =>
          Array.isArray(workspace?.members) &&
          workspace.members.some((member: any) => member?.userId === userData.id)
        )

        setCanManageTeam(allowed)
      } catch {}
    }

    loadAccess()

    return () => {
      mounted = false
    }
  }, [])

  const items = useMemo(() => {
    const nextItems = canManageTeam
      ? [...baseItems, { href: '/team', label: 'Команда', icon: Users }]
      : baseItems

    if (user?.systemRole !== 'SUPER_ADMIN') return nextItems

    return [
      ...nextItems,
      { href: '/admin', label: 'Админка', icon: Shield }
    ]
  }, [canManageTeam, user?.systemRole])

  return (
    <aside className="hidden w-80 print:hidden border-r border-cyan-300/10 bg-[#06101b]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),0_0_80px_rgba(34,211,238,0.05)] backdrop-blur-2xl lg:block">
      <div className="flex h-full flex-col p-5">
        <div className="rounded-[30px] border border-cyan-400/15 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.12),transparent_38%),rgba(255,255,255,0.035)] p-6 shadow-[0_0_52px_rgba(59,130,246,0.14)]">
          <div className="text-[11px] uppercase tracking-[0.35em] text-blue-100/70">Reputation OS</div>
          <div className="mt-2 text-xl font-semibold text-white">Reputation Inbox</div>
          <div className="mt-2 text-sm leading-6 text-slate-300">
            Центр мониторинга отзывов, упоминаний и репутационной аналитики.
          </div>
        </div>

        <nav className="mt-7 space-y-3">
          {items.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
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
      </div>
    </aside>
  )
}
