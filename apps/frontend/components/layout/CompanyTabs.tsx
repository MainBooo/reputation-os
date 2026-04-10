'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { Building2, Inbox, Radio, BarChart3, Star } from 'lucide-react'

export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname()

  const items = [
    { href: `/companies/${companyId}`, label: 'Обзор', icon: Building2 },
    { href: `/companies/${companyId}/inbox`, label: 'Inbox', icon: Inbox },
    { href: `/companies/${companyId}/vk`, label: 'VK', icon: Radio },
    { href: `/companies/${companyId}/analytics`, label: 'Аналитика', icon: BarChart3 },
    { href: `/companies/${companyId}/ratings`, label: 'Рейтинги', icon: Star }
  ]

  return (
    <div className="mb-6 overflow-x-auto px-1">
      <div className="inline-flex w-max min-w-0 gap-2 rounded-[24px] border border-cyan-400/15 bg-white/[0.03] p-2 shadow-[0_0_24px_rgba(34,211,238,0.08)] backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'inline-flex items-center gap-2 whitespace-nowrap rounded-2xl px-4 py-2.5 text-sm transition-all',
                active
                  ? 'bg-cyan-400/[0.14] text-white shadow-[0_0_18px_rgba(34,211,238,0.18)]'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
              )}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
