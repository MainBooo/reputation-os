import { apiFetch } from './client'

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type WorkspaceMember = {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  createdAt: string
  updatedAt: string
  user?: {
    id: string
    email: string
    fullName?: string | null
    isActive?: boolean
    lastLoginAt?: string | null
    createdAt?: string
  }
}

export function getWorkspaceMembers(workspaceId: string) {
  return apiFetch(`/workspaces/${workspaceId}/members`, undefined, [])
}

export function addWorkspaceMember(workspaceId: string, payload: { email: string; role: WorkspaceRole }) {
  return apiFetch(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function updateWorkspaceMemberRole(workspaceId: string, memberId: string, payload: { role: WorkspaceRole }) {
  return apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function removeWorkspaceMember(workspaceId: string, memberId: string) {
  return apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'DELETE'
  })
}
