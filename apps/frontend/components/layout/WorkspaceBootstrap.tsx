'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { me } from '@/lib/api/auth'
import { apiFetch } from '@/lib/api/client'
import { pickWorkspaceId, WORKSPACE_QUERY_KEY, WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { useChatContext } from '@/lib/chat/ChatContext'

export default function WorkspaceBootstrap() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const search = searchParams.toString()
  const requestedWorkspaceId = searchParams.get(WORKSPACE_QUERY_KEY)
  const { setWorkspaceId } = useChatContext()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        await me()

        const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)
        const workspaces = await apiFetch<{ id: string }[]>('/workspaces', undefined, [])
        const requestedId = requestedWorkspaceId || stored
        const validId = pickWorkspaceId(workspaces, requestedId)

        if (validId) {
          if (validId !== stored) localStorage.setItem(WORKSPACE_STORAGE_KEY, validId)
          if (mounted) {
            setWorkspaceId(validId)

            if (requestedWorkspaceId !== validId) {
              const nextParams = new URLSearchParams(search)
              nextParams.set(WORKSPACE_QUERY_KEY, validId)
              router.replace(`${pathname}?${nextParams.toString()}`, { scroll: false })
            }
          }
        } else if (mounted) {
          setWorkspaceId('')
        }
      } catch {
        // not authenticated or workspace fetch failed — nothing to bootstrap
      }
    })()
    return () => {
      mounted = false
    }
  }, [pathname, requestedWorkspaceId, router, search, setWorkspaceId])

  return null
}
