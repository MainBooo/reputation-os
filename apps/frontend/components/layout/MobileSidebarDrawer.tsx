'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from 'clsx'
import { ChevronDown, Sparkles, X } from 'lucide-react'
import SidebarTasksCard from './SidebarTasksCard'
import AccountPanel from './AccountPanel'
import { useSidebar } from '@/lib/layout/SidebarContext'
import { useSidebarNavItems, isNavItemActive } from '@/lib/layout/useSidebarNavItems'

export default function MobileSidebarDrawer() {
  const { isSidebarOpen, closeSidebar, triggerRef } = useSidebar()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const items = useSidebarNavItems()
  const [tasksOpen, setTasksOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isSidebarOpen])

  useEffect(() => {
    if (isSidebarOpen) {
      closeButtonRef.current?.focus()
    } else {
      triggerRef.current?.focus()
    }
  }, [isSidebarOpen, triggerRef])

  useEffect(() => {
    if (!isSidebarOpen) return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeSidebar()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isSidebarOpen, closeSidebar])

  // Route changes (link clicks, back/forward, redirects) always close the drawer.
  useEffect(() => {
    closeSidebar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return (
    <div
      className={clsx(
        'fixed inset-0 z-[70] lg:hidden transition-all duration-300',
        isSidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
      )}
    >
      <button
        type="button"
        aria-label="Закрыть меню"
        tabIndex={isSidebarOpen ? 0 : -1}
        className={clsx(
          'absolute inset-0 bg-black/65 backdrop-blur-sm transition-opacity duration-300',
          isSidebarOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={closeSidebar}
      />

      <aside
        id="app-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Навигация"
        className={clsx(
          'relative flex h-[100dvh] w-[min(88vw,360px)] max-w-full flex-col border-r border-cyan-300/10 bg-[#06101b] shadow-[0_0_80px_rgba(34,211,238,0.12)] transition-transform duration-300 ease-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* A. Header — fixed, ~64-72px, safe-area-aware */}
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[#06101b] px-5 pb-3.5"
          style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)' }}
        >
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.35em] text-blue-100/70">Reputation OS</div>
            <div className="mt-1 truncate text-base font-semibold text-white">Reputation Inbox</div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeSidebar}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Закрыть меню"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* B. Scrollable navigation — same nav config as desktop Sidebar */}
        <nav className="flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            {items.map((item) => {
              const Icon = item.icon
              const active = isNavItemActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeSidebar}
                  className={clsx(
                    'flex min-h-[48px] items-center gap-3 rounded-[18px] border px-4 py-3 text-sm transition-all duration-200',
                    active
                      ? 'border-cyan-400/40 bg-cyan-400/[0.14] text-white shadow-[0_0_24px_rgba(34,211,238,0.2)]'
                      : 'border-white/8 bg-white/[0.025] text-slate-300 active:bg-white/[0.06]'
                  )}
                >
                  <span className={clsx(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition',
                    active
                      ? 'border-blue-300/30 bg-cyan-300/10 text-blue-100'
                      : 'border-white/10 bg-white/[0.04] text-slate-400'
                  )}>
                    <Icon size={17} />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>

          <div className="mt-5">
            <button
              type="button"
              onClick={() => setTasksOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.05]"
              aria-expanded={tasksOpen}
            >
              <span className="flex items-center gap-2">
                <Sparkles size={15} className="text-cyan-300" />
                Сегодня
              </span>
              <ChevronDown className={clsx('h-4 w-4 text-slate-400 transition-transform', tasksOpen && 'rotate-180')} />
            </button>

            {tasksOpen && <SidebarTasksCard />}
          </div>
        </nav>

        {/* C. Compact account footer — fixed, safe-area-aware */}
        <div
          className="shrink-0 border-t border-white/10 bg-[#050d17] px-4 pt-4"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <AccountPanel onNavigate={closeSidebar} dropdownAlign="up" />
        </div>
      </aside>
    </div>
  )
}
