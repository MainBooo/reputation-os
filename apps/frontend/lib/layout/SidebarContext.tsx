'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

interface SidebarContextValue {
  isSidebarOpen: boolean
  openSidebar: () => void
  closeSidebar: () => void
  toggleSidebar: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used inside SidebarProvider')
  return ctx
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const openSidebar = useCallback(() => setIsSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setIsSidebarOpen(false), [])
  const toggleSidebar = useCallback(() => setIsSidebarOpen((value) => !value), [])

  const value = useMemo<SidebarContextValue>(
    () => ({ isSidebarOpen, openSidebar, closeSidebar, toggleSidebar, triggerRef }),
    [isSidebarOpen, openSidebar, closeSidebar, toggleSidebar]
  )

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
}
