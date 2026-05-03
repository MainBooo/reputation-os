'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { LayoutDashboard, Building2, Settings, Sparkles } from 'lucide-react'

const items = [
  { href: '/dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { href: '/companies', label: 'Компании', icon: Building2 },
  { href: '/settings', label: 'Настройки', icon: Settings }
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-80 border-r border-white/10 bg-[#071019]/90 backdrop-blur-2xl lg:block">
      <div className="flex h-full flex-col p-5">
        <div className="rounded-[28px] border border-cyan-400/15 bg-white/[0.03] p-5 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
          <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-200/70">Reputation OS</div>
          <div className="mt-2 text-xl font-semibold text-white">Reputation Inbox</div>
          <div className="mt-2 text-sm leading-6 text-slate-300">
            Центр мониторинга отзывов, упоминаний и репутационной аналитики.
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          {items.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'group flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-all duration-200',
                  active
                    ? 'border-cyan-400/30 bg-cyan-400/[0.12] text-white shadow-[0_0_24px_rgba(34,211,238,0.18)]'
                    : 'border-white/8 bg-white/[0.025] text-slate-300 hover:border-cyan-400/20 hover:bg-white/[0.05] hover:text-white'
                )}
              >
                <span className={clsx(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition',
                  active
                    ? 'border-cyan-300/30 bg-cyan-300/10 text-cyan-200'
                    : 'border-white/10 bg-white/[0.04] text-slate-400 group-hover:text-cyan-200'
                )}>
                  <Icon size={17} />
                </span>
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-6 rounded-[28px] border border-fuchsia-400/15 bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.03] to-fuchsia-400/[0.08] p-5 shadow-[0_0_34px_rgba(168,85,247,0.12)]">
          <div className="flex items-center gap-2 text-sm font-medium text-white">
            <Sparkles size={16} className="text-cyan-200" />
            Быстрая навигация
          </div>
          <div className="mt-2 text-xs leading-6 text-slate-300">
            Открой компанию и переходи между Обзором, Inbox, Аналитикой и Рейтингами без ручного ввода адреса.
          </div>
        </div>
      </div>
    </aside>
  )
}
