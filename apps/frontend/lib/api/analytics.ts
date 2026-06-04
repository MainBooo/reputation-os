import { apiFetch } from './client'

export function getAnalyticsOverview(id: string, query = '') {
  return apiFetch(`/companies/${id}/analytics/overview${query}`, undefined, {
    mentionsCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    reviewsCount: 0,
    rating: 0,
    positiveShare: 0,
    trend: [],
    reputationTrend: [],
    latest: [],
    deltas: { total: 0, positive: 0, negative: 0 }
  })
}

export function getAnalyticsSentiment(id: string) {
  return apiFetch(`/companies/${id}/analytics/sentiment`, undefined, [])
}

export function getAnalyticsPlatforms(id: string, query = '') {
  return apiFetch(`/companies/${id}/analytics/platforms${query}`, undefined, {
    items: [],
    platforms: [],
    webCount: 0
  })
}
