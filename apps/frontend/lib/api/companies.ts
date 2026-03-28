import { apiFetch } from './client'

export function getCompanies() {
  return apiFetch('/companies', undefined, [])
}

export function getCompany(id: string) {
  return apiFetch(`/companies/${id}`)
}
