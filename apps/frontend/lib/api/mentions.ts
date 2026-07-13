import { apiFetch } from './client'

export type CompanyMentionsResponse = {
  data: any[]
  meta: {
    total: number
    page: number
    limit: number
    averageRating?: number | null
    ratedCount?: number
  }
}

function normalizeQuery(query = '') {
  if (!query) return ''
  return query.startsWith('?') ? query : `?${query}`
}

export function getCompanyMentions(id: string, query = ''): Promise<CompanyMentionsResponse> {
  return apiFetch(`/companies/${id}/mentions${normalizeQuery(query)}`, undefined, {
    data: [],
    meta: { total: 0, page: 1, limit: 20, averageRating: null, ratedCount: 0 }
  })
}

export function generateReply(id: string, preset?: 'FORMAL' | 'FRIENDLY' | 'CONCISE') {
  return apiFetch(`/mentions/${id}/generate-reply`, {
    method: 'POST',
    body: JSON.stringify(preset ? { preset } : {})
  }, {
    draftText: 'Спасибо за отзыв!'
  })
}

export function updateMentionStatus(id: string, status: 'REVIEWED' | 'ARCHIVED') {
  return apiFetch(`/mentions/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
}

export function deleteMention(id: string) {
  return apiFetch(`/mentions/${id}`, {
    method: 'DELETE'
  }, {
    ok: true
  })
}
