'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutDashboard, Building2, Settings } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <div
      className="sticky bottom-0 z-30 border-t border-cyan-400/15 bg-[#071019]/90 px-3 pt-3 backdrop-blur-2xl lg:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}
    >
      <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2 shadow-[0_0_30px_rgba(34,211,238,0.08)]">
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
                  ? 'bg-cyan-400/[0.14] text-white shadow-[0_0_18px_rgba(34,211,238,0.18)]'
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
