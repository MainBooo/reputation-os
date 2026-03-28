import { apiFetch } from './client'

export function getCompanyMentions(id: string, query = '') {
  return apiFetch(`/companies/${id}/mentions${query}`, undefined, {
    data: [],
    meta: { total: 0, page: 1, limit: 20 }
  })
}

export function generateReply(id: string) {
  return apiFetch(`/mentions/${id}/generate-reply`, {
    method: 'POST',
    body: JSON.stringify({})
  }, {
    draftText: 'Спасибо за отзыв!'
  })
}
