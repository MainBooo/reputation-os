import { apiFetch } from './client'

export function getAnalyticsOverview(id: string, query = '') {
  return apiFetch(`/companies/${id}/analytics/overview${query}`, undefined, {
    mentionsCount: 0,
    positiveCount: 0,
    neutralCount: 0,
    negativeCount: 0,
    reviewsCount: 0,
    rating: null,
    positiveShare: null,
    trend: [],
    reputationTrend: [],
    latest: [],
    platformDistribution: [],
    deltas: { total: null, positive: null, negative: null, rating: null }
  })
}

export function getAnalyticsSentiment(id: string, query = '') {
  return apiFetch(`/companies/${id}/analytics/sentiment${query}`, undefined, [])
}

export function getAnalyticsPlatforms(id: string, query = '') {
  return apiFetch(`/companies/${id}/analytics/platforms${query}`, undefined, {
    items: [],
    platforms: [],
    webCount: 0
  })
}
