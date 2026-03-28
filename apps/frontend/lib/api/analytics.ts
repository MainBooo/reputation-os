import { apiFetch } from './client'

export function getAnalyticsOverview(id: string) {
  return apiFetch(`/companies/${id}/analytics/overview`, undefined, {
    mentionsCount: 0,
    negativeCount: 0,
    reviewsCount: 0,
    latest: []
  })
}

export function getAnalyticsSentiment(id: string) {
  return apiFetch(`/companies/${id}/analytics/sentiment`, undefined, [])
}

export function getAnalyticsPlatforms(id: string) {
  return apiFetch(`/companies/${id}/analytics/platforms`, undefined, {
    platforms: [],
    vkCount: 0
  })
}
