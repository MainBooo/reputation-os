import { apiFetch } from './client'

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export interface WorkspaceMember {
  id: string
  role: WorkspaceRole
  user: {
    id: string
    email: string
    fullName?: string | null
    isActive: boolean
    lastLoginAt?: string | null
    createdAt: string
  }
}

export interface WorkspaceInvite {
  id: string
  email: string
  role: WorkspaceRole
  token: string
  expiresAt: string
  createdAt: string
}

export async function getWorkspaceMembers(workspaceId: string) {
  return apiFetch<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`)
}

export async function getWorkspaceInvites(workspaceId: string) {
  return apiFetch<WorkspaceInvite[]>(`/workspaces/${workspaceId}/invites`)
}

export async function createWorkspaceInvite(
  workspaceId: string,
  payload: {
    email: string
    role: 'ADMIN' | 'MEMBER'
  }
) {
  return apiFetch(`/workspaces/${workspaceId}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function acceptWorkspaceInvite(token: string) {
  return apiFetch('/workspaces/invites/accept', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
}


export async function addWorkspaceMember(
  workspaceId: string,
  payload: {
    email: string
    role: WorkspaceRole
  }
) {
  return apiFetch(`/workspaces/${workspaceId}/members`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  payload: {
    role: WorkspaceRole
  }
) {
  return apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export async function removeWorkspaceMember(
  workspaceId: string,
  memberId: string
) {
  return apiFetch(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: 'DELETE'
  })
}
