'use client'

import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import SidebarTasksCard from './SidebarTasksCard'
import AccountPanel from './AccountPanel'
import { useSidebar } from '@/lib/layout/SidebarContext'

export default function MobileSidebarDrawer() {
  const { isSidebarOpen, closeSidebar, triggerRef } = useSidebar()
  const closeButtonRef = useRef<HTMLButtonElement>(null)

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
          'relative flex h-full w-[86vw] max-w-[360px] flex-col border-r border-cyan-300/10 bg-[#06101b]/98 shadow-[0_0_80px_rgba(34,211,238,0.12)] transition-transform duration-300 ease-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.35em] text-blue-100/70">Reputation OS</div>
              <div className="mt-2 text-xl font-semibold text-white">Reputation Inbox</div>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeSidebar}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] hover:text-white"
              aria-label="Закрыть меню"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 rounded-[26px] border border-cyan-400/15 bg-[radial-gradient(circle_at_15%_0%,rgba(34,211,238,0.12),transparent_38%),rgba(255,255,255,0.035)] p-5 text-sm leading-6 text-slate-300">
            Центр мониторинга отзывов, упоминаний и репутационной аналитики.
          </div>

          <SidebarTasksCard />
        </div>

        <div className="shrink-0 border-t border-white/10 bg-white/[0.02] p-4">
          <AccountPanel onNavigate={closeSidebar} dropdownAlign="up" />
        </div>
      </aside>
    </div>
  )
}
