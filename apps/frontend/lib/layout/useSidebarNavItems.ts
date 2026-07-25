'use client'

import { useEffect, useMemo, useState } from 'react'
import { LayoutDashboard, Building2, Settings, Shield, Users, type LucideIcon } from 'lucide-react'
import { me, type AuthMe } from '@/lib/api/auth'
import { getWorkspaces } from '@/lib/api/companies'

export interface SidebarNavItem {
  href: string
  label: string
  icon: LucideIcon
}

const baseItems: SidebarNavItem[] = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

/**
 * Single source of truth for the app's primary navigation — routes, labels,
 * icons and permission checks. Consumed by both the desktop Sidebar and the
 * mobile drawer so they can never drift apart item-by-item.
 */
export function useSidebarNavItems(): SidebarNavItem[] {
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

  return useMemo(() => {
    const nextItems = canManageTeam
      ? [...baseItems, { href: '/team', label: 'Команда', icon: Users }]
      : baseItems

    if (user?.systemRole !== 'SUPER_ADMIN') return nextItems

    return [...nextItems, { href: '/admin', label: 'Админка', icon: Shield }]
  }, [canManageTeam, user?.systemRole])
}
