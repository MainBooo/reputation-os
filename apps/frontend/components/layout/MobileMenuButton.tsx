'use client'

import { Menu } from 'lucide-react'
import { useSidebar } from '@/lib/layout/SidebarContext'

export default function MobileMenuButton() {
  const { isSidebarOpen, openSidebar, triggerRef } = useSidebar()

  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={openSidebar}
      aria-label="Открыть меню"
      aria-expanded={isSidebarOpen}
      aria-controls="app-sidebar-drawer"
      className="fixed z-40 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#0a1424]/85 text-slate-200 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition hover:border-cyan-400/25 hover:bg-cyan-500/[0.12] hover:text-white active:scale-[0.97] lg:hidden"
      style={{
        top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        left: 'calc(env(safe-area-inset-left, 0px) + 12px)'
      }}
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}
