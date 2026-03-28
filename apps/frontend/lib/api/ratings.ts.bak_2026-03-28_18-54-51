import { apiFetch } from './client'

export function getRatingsOverview(id: string) {
  return apiFetch(`/companies/${id}/ratings/overview`, undefined, {
    aggregatedRating: 4.6,
    platforms: []
  })
}

export function getRatingsHistory(id: string) {
  return apiFetch(`/companies/${id}/ratings/history`, undefined, [])
}
