'use client'

import { useEffect, useState } from 'react'
import { WORKSPACE_STORAGE_KEY } from '@/lib/workspace-selection'
import { apiFetch } from '@/lib/api/client'

export function useWorkspaceId() {
  const [workspaceId, setWorkspaceId] = useState<string>('')

  useEffect(() => {
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY) || ''
    if (stored) {
      setWorkspaceId(stored)
      return
    }

    apiFetch<{ id: string }[]>('/workspaces', undefined, []).then((workspaces) => {
      const id = Array.isArray(workspaces) && workspaces[0]?.id ? workspaces[0].id : ''
      if (id) {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, id)
        setWorkspaceId(id)
      }
    }).catch(() => {})
  }, [])

  return workspaceId
}
