import { apiFetch } from './client'

export type AuthMe = {
  id: string
  email: string
  fullName?: string | null
  isActive?: boolean
}

export function login(payload: { email: string; password: string }) {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function register(payload: { email: string; password: string; fullName?: string }) {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function me() {
  return apiFetch<AuthMe>('/auth/me')
}

export function logoutLocal() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem('accessToken')
  } catch {}
  document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=lax'
}
