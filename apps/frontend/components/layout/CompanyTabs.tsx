'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { BarChart3, Building2, Clock3, Globe2, Inbox, Star } from 'lucide-react'

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname()

  const items = [
    { href: `/companies/${companyId}`, label: 'Обзор', icon: Building2 },
    { href: `/companies/${companyId}/inbox`, label: 'Inbox', icon: Inbox },
    { href: `/companies/${companyId}/web`, label: 'Сеть', icon: Globe2 },
    { href: `/companies/${companyId}/analytics`, label: 'Аналитика', icon: BarChart3 },
    { href: `/companies/${companyId}/ratings`, label: 'Рейтинги', icon: Star },
    { href: `/companies/${companyId}/sync-history`, label: 'Синхр.', icon: Clock3 }
  ]

  return (
    <nav className="relative w-full overflow-hidden rounded-[34px] border border-cyan-300/25 bg-[radial-gradient(circle_at_0%_0%,rgba(59,130,246,0.26),transparent_34%),radial-gradient(circle_at_100%_0%,rgba(217,70,239,0.22),transparent_34%),rgba(5,10,24,0.94)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_60px_rgba(59,130,246,0.34),0_0_90px_rgba(217,70,239,0.14)] backdrop-blur-2xl">
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-fuchsia-300" />
      <div className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-fuchsia-400/70" />

      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'group relative flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-[22px] border px-4 py-3 text-sm font-semibold transition-all duration-200',
                active
                  ? 'border-cyan-300/60 bg-cyan-500/[0.22] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_46px_rgba(34,211,238,0.38)]'
                  : 'border-transparent bg-transparent text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-500/[0.08] hover:text-white'
              )}
            >
              {active ? (
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(59,130,246,0.26),transparent_58%)]" />
              ) : null}

              <Icon className="relative h-5 w-5 shrink-0 drop-shadow-[0_0_12px_currentColor] sm:h-7 sm:w-7" />
              <span className="relative whitespace-nowrap">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
