import { apiFetch } from './client'

export type AdminSystemRole = 'USER' | 'SUPER_ADMIN'

export function getAdminOverview() {
  return apiFetch('/admin/overview', undefined, {
    usersCount: 0,
    workspacesCount: 0,
    companiesCount: 0,
    mentionsCount: 0
  })
}

export function getAdminUsers(query = '') {
  return apiFetch(`/admin/users${query}`, undefined, [])
}

export function updateAdminUser(
  userId: string,
  payload: { isActive?: boolean; systemRole?: AdminSystemRole }
) {
  return apiFetch(`/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function getAdminWorkspaces() {
  return apiFetch('/admin/workspaces', undefined, [])
}
