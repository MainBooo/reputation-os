'use client'

import { useEffect, useMemo, useState } from 'react'
import { me } from '@/lib/api/auth'
import { getWorkspaceMembers, type WorkspaceRole } from '@/lib/api/workspaces'

export function useWorkspaceAccess(workspaceId?: string | null) {
  const [role, setRole] = useState<WorkspaceRole | 'SUPER_ADMIN' | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function load() {
      if (!workspaceId) {
        setRole(null)
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const user = await me()

        if (user.systemRole === 'SUPER_ADMIN') {
          if (active) setRole('SUPER_ADMIN')
          return
        }

        const members = await getWorkspaceMembers(workspaceId)
        const currentMember = members.find((member) => member.user?.id === user.id)

        if (active) setRole(currentMember?.role || null)
      } catch {
        if (active) setRole(null)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()

    return () => {
      active = false
    }
  }, [workspaceId])

  const canWrite = useMemo(() => {
    return role === 'SUPER_ADMIN' || role === 'OWNER' || role === 'ADMIN'
  }, [role])

  const isMemberOnly = role === 'MEMBER'

  return {
    role,
    loading,
    canWrite,
    isMemberOnly
  }
}
