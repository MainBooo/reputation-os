import { apiFetch } from './client'

export function getCompanies() {
  return apiFetch('/companies', undefined, [])
}

export function getCompany(id: string) {
  return apiFetch(`/companies/${id}`, undefined, {
    id,
    name: 'Acme Corp',
    website: 'https://acme.example.com',
    city: 'Moscow',
    industry: 'Tech',
    aliases: [],
    sourceTargets: [],
    _count: { mentions: 12, ratingSnapshots: 4 }
  })
}
