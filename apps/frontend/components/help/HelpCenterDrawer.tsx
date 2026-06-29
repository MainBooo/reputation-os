'use client'

import { useEffect, useRef } from 'react'
import { X, Rocket, Bot, Bell, CreditCard, HelpCircle, MessageCircle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import clsx from 'clsx'

interface HelpCenterDrawerProps {
  open: boolean
  onClose: () => void
}

interface HelpItem {
  label: string
  href?: string
  onClick?: () => void
  external?: boolean
}

interface HelpSection {
  icon: React.ReactNode
  title: string
  items: HelpItem[]
}

const SECTIONS: HelpSection[] = [
  {
    icon: <Rocket className="h-4 w-4" />,
    title: 'Быстрый старт',
    items: [
      { label: 'Как добавить компанию', href: '/companies' },
      { label: 'Как подключить Яндекс Карты', href: '/companies' },
      { label: 'Как подключить 2ГИС', href: '/companies' },
      { label: 'Как работает веб-поиск', href: '/companies' },
    ],
  },
  {
    icon: <Bot className="h-4 w-4" />,
    title: 'AI-ответы',
    items: [
      { label: 'Как генерировать ответы на отзывы', href: '/companies' },
      { label: 'Лимиты AI-ответов в тарифе', href: '/billing/checkout' },
    ],
  },
  {
    icon: <Bell className="h-4 w-4" />,
    title: 'Уведомления',
    items: [
      { label: 'Push-уведомления в браузере', href: '/settings' },
      { label: 'Подключить Telegram-уведомления', href: '/settings' },
    ],
  },
  {
    icon: <CreditCard className="h-4 w-4" />,
    title: 'Подписки и оплата',
    items: [
      { label: 'Как работает пробный период', href: '/billing/checkout' },
      { label: 'Как сменить тариф', href: '/billing/checkout' },
      { label: 'Что будет после окончания Trial', href: '/billing/checkout' },
      { label: 'Оплата через ЮKassa', href: '/billing/checkout' },
    ],
  },
  {
    icon: <HelpCircle className="h-4 w-4" />,
    title: 'Частые вопросы',
    items: [
      { label: 'Когда появятся первые отзывы?', href: '#faq-first-reviews' },
      { label: 'Можно ли добавить несколько компаний?', href: '/billing/checkout' },
      { label: 'Что делать, если источник не подключается?', href: '/companies' },
      { label: 'Можно ли отменить подписку?', href: '/billing/checkout' },
    ],
  },
]

export default function HelpCenterDrawer({ open, onClose }: HelpCenterDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className="animate-drawer-in absolute right-0 top-0 flex h-full w-full max-w-sm flex-col overflow-hidden border-l border-white/10 bg-[#060d18] shadow-[-20px_0_80px_rgba(0,0,0,0.6)]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-cyan-300">ReputationOS</div>
            <div className="mt-0.5 text-lg font-semibold tracking-[-0.03em] text-white">Помощь и руководство</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-white/20 hover:bg-white/[0.09] hover:text-white active:scale-[0.95]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-5">
            {SECTIONS.map((section) => (
              <div key={section.title}>
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  <span className="text-slate-400">{section.icon}</span>
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href ?? '#'}
                      onClick={onClose}
                      className="group flex items-center justify-between rounded-[16px] border border-transparent px-3.5 py-2.5 text-sm text-slate-300 transition-all duration-150 hover:border-white/10 hover:bg-white/[0.055] hover:text-white"
                    >
                      <span>{item.label}</span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-slate-400" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Support block */}
          <div className="mt-6 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
              <MessageCircle className="h-4 w-4 text-cyan-300" />
              Поддержка
            </div>
            <p className="mb-3 text-sm leading-5 text-slate-400">
              Не нашли ответ? Напишите нам — ответим быстро.
            </p>
            <a
              href="https://t.me/reputationos_support"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-[14px] border border-cyan-400/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 active:scale-[0.97]"
            >
              Написать в Telegram
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
