'use client'

import { createContext, useContext, useMemo, useState } from 'react'

interface MobileDrawerContextValue {
  open: boolean
  openDrawer: () => void
  closeDrawer: () => void
}

const MobileDrawerContext = createContext<MobileDrawerContextValue | null>(null)

export function useMobileDrawer() {
  const ctx = useContext(MobileDrawerContext)
  if (!ctx) throw new Error('useMobileDrawer must be used inside MobileDrawerProvider')
  return ctx
}

export function MobileDrawerProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const value = useMemo<MobileDrawerContextValue>(() => ({
    open,
    openDrawer: () => setOpen(true),
    closeDrawer: () => setOpen(false)
  }), [open])

  return <MobileDrawerContext.Provider value={value}>{children}</MobileDrawerContext.Provider>
}
