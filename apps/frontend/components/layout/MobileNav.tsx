'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutDashboard, Building2, Settings, Shield, Users } from 'lucide-react'
import { me, type AuthMe } from '@/lib/api/auth'
import { getWorkspaces } from '@/lib/api/companies'

const baseItems = [
  { href: '/dashboard', label: 'Панель', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export default function MobileNav() {
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

  const items = useMemo(() => {
    const nextItems = canManageTeam
      ? [...baseItems, { href: '/team', label: 'Команда', icon: Users }]
      : baseItems

    if (user?.systemRole !== 'SUPER_ADMIN') return nextItems
    return [...nextItems, { href: '/admin', label: 'Админ', icon: Shield }]
  }, [canManageTeam, user?.systemRole])

  return (
    <div
      className="sticky bottom-0 z-30 print:hidden border-t border-cyan-400/15 bg-[#071019]/90 px-3 pt-3 backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className={clsx(
        'grid gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2 shadow-[0_0_30px_rgba(59,130,246,0.12)]',
        items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
      )}>
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] transition-all',
                active
                  ? 'bg-cyan-400/[0.14] text-white shadow-[0_0_18px_rgba(59,130,246,0.34)]'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
