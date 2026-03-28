import { apiFetch } from './client'

export function getCompanies() {
  return apiFetch('/companies', undefined, [])
}

export function getCompany(id: string) {
  return apiFetch(`/companies/${id}`)
}

export function getWorkspaces() {
  return apiFetch('/workspaces', undefined, [])
}

export function createCompany(payload: {
  workspaceId: string
  name: string
  website?: string
  city?: string
  industry?: string
}) {
  return apiFetch('/companies', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}


export function deleteCompany(id: string) {
  return apiFetch(`/companies/${id}`, {
    method: 'DELETE'
  })
}
