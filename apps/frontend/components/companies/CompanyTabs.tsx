'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { BarChart3, Building2, Globe2, Inbox, Star } from 'lucide-react'

const items = [
  { href: '', label: 'Обзор', icon: Building2, tone: 'cyan' },
  { href: '/inbox', label: 'Inbox', icon: Inbox, tone: 'violet' },
  { href: '/web', label: 'Сеть', icon: Globe2, tone: 'cyan' },
  { href: '/analytics', label: 'Аналитика', icon: BarChart3, tone: 'violet' },
  { href: '/ratings', label: 'Рейтинги', icon: Star, tone: 'cyan' }
]

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname()
  const base = `/companies/${companyId}`

  return (
    <nav className="relative w-full overflow-hidden rounded-[32px] border border-cyan-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.34),transparent_32%),radial-gradient(circle_at_100%_0%,rgba(217,70,239,0.18),transparent_34%),rgba(4,10,20,0.92)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_0_70px_rgba(34,211,238,0.16),0_0_90px_rgba(217,70,239,0.10)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-300" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-fuchsia-400/70" />

      <div className="grid grid-cols-5 gap-1.5">
        {items.map((item) => {
          const href = `${base}${item.href}`
          const active = pathname === href
          const Icon = item.icon

          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'group relative flex min-w-0 items-center justify-center gap-2 overflow-hidden rounded-[26px] border px-2 py-4 text-sm font-semibold transition-all duration-200 sm:gap-3 sm:px-5 sm:py-5 sm:text-lg',
                active
                  ? 'border-cyan-300/55 bg-cyan-500/[0.20] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_0_44px_rgba(34,211,238,0.34)]'
                  : 'border-transparent bg-transparent text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-500/[0.08] hover:text-white'
              )}
            >
              {active ? (
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.34),transparent_52%)]" />
              ) : null}

              <Icon className="relative h-5 w-5 shrink-0 drop-shadow-[0_0_12px_currentColor] sm:h-7 sm:w-7" />
              <span className="relative truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
