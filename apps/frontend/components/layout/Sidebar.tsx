'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { BarChart3, Building2, LayoutDashboard, Settings, MessagesSquare } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/companies', label: 'Companies', icon: Building2 },
  { href: '/settings', label: 'Settings', icon: Settings }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 border-r border-line bg-[#0E1116] p-5 lg:block">
      <div className="mb-8">
        <div className="text-xs uppercase tracking-[0.2em] text-muted">Reputation OS</div>
        <div className="mt-2 text-lg font-semibold text-brand">Reputation Inbox</div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                active ? 'bg-white/10 text-brand' : 'text-muted hover:bg-white/5 hover:text-brand'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-10 rounded-2xl border border-line bg-panel p-4">
        <div className="text-sm font-medium text-brand">VK monitoring</div>
        <div className="mt-2 text-xs leading-5 text-muted">
          BRAND_SEARCH, PRIORITY_COMMUNITIES и OWNED_COMMUNITY готовы в общей архитектуре.
        </div>
      </div>
    </aside>
  )
}
