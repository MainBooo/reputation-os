'use client'

import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { ArrowUp } from 'lucide-react'
import { useSidebar } from '@/lib/layout/SidebarContext'

const SHOW_AFTER_PX = 480

export default function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)
  const { isSidebarOpen } = useSidebar()

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > SHOW_AFTER_PX)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shown = visible && !isSidebarOpen

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Наверх"
      aria-hidden={!shown}
      tabIndex={shown ? 0 : -1}
      className={clsx(
        'fixed z-40 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#0a1424]/85 text-slate-200 shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-2xl transition-all duration-300 ease-out hover:border-cyan-400/25 hover:bg-cyan-500/[0.12] hover:text-white active:scale-[0.97] lg:hidden',
        shown ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-2 opacity-0 pointer-events-none'
      )}
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 170px)',
        right: 'calc(env(safe-area-inset-right, 0px) + 16px)'
      }}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}
