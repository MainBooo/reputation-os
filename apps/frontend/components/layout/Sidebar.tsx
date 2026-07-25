'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import SidebarTasksCard from './SidebarTasksCard'
import AccountPanel from './AccountPanel'
import { useSidebarNavItems, isNavItemActive } from '@/lib/layout/useSidebarNavItems'

export default function Sidebar() {
  const pathname = usePathname()
  const items = useSidebarNavItems()

  return (
    <aside className="hidden w-80 print:hidden border-r border-cyan-300/10 bg-[#06101b]/95 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04),0_0_80px_rgba(34,211,238,0.05)] backdrop-blur-2xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex-1 overflow-y-auto p-5">
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
            const active = isNavItemActive(pathname, item.href)
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

      <div className="shrink-0 border-t border-white/10 bg-white/[0.02] p-5">
        <AccountPanel dropdownAlign="up" />
      </div>
    </aside>
  )
}
