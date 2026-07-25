'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { me } from '@/lib/api/auth'
import { apiFetch } from '@/lib/api/client'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { useChatContext } from '@/lib/chat/ChatContext'

export default function WorkspaceBootstrap() {
  const pathname = usePathname()
  const { setWorkspaceId } = useChatContext()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await me()

        const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
        if (stored) setWorkspaceId(stored) // optimistic set from cache
        const workspaces = await apiFetch<{ id: string }[]>('/workspaces', undefined, [])
        const validId = Array.isArray(workspaces) && workspaces.length
          ? (workspaces.find((w) => w.id === stored)?.id ?? workspaces[0].id)
          : stored ?? ''
        if (validId) {
          if (validId !== stored) localStorage.setItem(WORKSPACE_STORAGE_KEY, validId)
          if (mounted) setWorkspaceId(validId)
        }
      } catch {
        // not authenticated or workspace fetch failed — nothing to bootstrap
      }
    })()
    return () => {
      mounted = false
    }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
