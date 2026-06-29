import { apiFetch } from './client'

export function markWelcomeSeen() {
  return apiFetch<{ ok: boolean }>('/auth/me/welcome-seen', { method: 'PATCH' })
}
