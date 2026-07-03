'use client'

import { usePathname } from 'next/navigation'

const TABS = [
  { href: '/legal', label: 'Реквизиты' },
  { href: '/legal/oferta', label: 'Публичная оферта' },
  { href: '/legal/privacy', label: 'Политика конфиденциальности' },
]

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-[#050b12] text-white">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-8">
          <a href="/" className="text-xs font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
            ← Reputation OS
          </a>
        </div>

        <nav className="mb-10 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4">
          {TABS.map((tab) => {
            const active = pathname === tab.href
            return (
              <a
                key={tab.href}
                href={tab.href}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-cyan-500/15 text-cyan-200'
                    : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </a>
            )
          })}
        </nav>

        {children}
      </div>
    </div>
  )
}
