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
  yandexUrl?: string
  twoGisUrl?: string
  keywords?: string[]
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


export function getCompanySourceTargets(companyId: string) {
  return apiFetch(`/companies/${companyId}/sources`, undefined, [])
}

export function createCompanySourceTarget(
  companyId: string,
  payload: {
    sourceId?: string
    platform?: 'WEB' | 'CUSTOM'
    externalUrl?: string
    externalPlaceId?: string
    displayName?: string
    syncReviewsEnabled?: boolean
    syncRatingsEnabled?: boolean
    syncMentionsEnabled?: boolean
    config?: Record<string, unknown>
  }
) {
  return apiFetch(`/companies/${companyId}/sources`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function startCompanySync(companyId: string) {
  return apiFetch(`/companies/${companyId}/start-sync`, {
    method: 'POST',
    body: JSON.stringify({})
  })
}

export function updateCompanySourceTarget(
  companyId: string,
  targetId: string,
  payload: {
    syncReviewsEnabled?: boolean
    syncRatingsEnabled?: boolean
    syncMentionsEnabled?: boolean
    isActive?: boolean
    externalUrl?: string
    externalPlaceId?: string
    displayName?: string
    config?: Record<string, unknown>
  }
) {
  return apiFetch(`/companies/${companyId}/sources/${targetId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function updateCompany(id: string, payload: {
  name?: string
  website?: string
  city?: string
  industry?: string
  yandexUrl?: string
  twoGisUrl?: string
  keywords?: string[]
}) {
  return apiFetch(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}


export function deleteCompanySourceTarget(companyId: string, targetId: string) {
  return apiFetch(`/companies/${companyId}/sources/${targetId}`, {
    method: 'DELETE'
  })
}


export function getCompanySyncStatus(companyId: string) {
  return apiFetch(`/companies/${companyId}/sync-status`, undefined, {
    companyId,
    status: 'PENDING',
    hasActiveJob: false,
    lastFailedLog: null,
    lastSuccessLog: null,
    queues: [],
    logs: []
  })
}
