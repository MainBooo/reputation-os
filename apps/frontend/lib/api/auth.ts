import { apiFetch } from './client'

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
  return apiFetch('/auth/me', undefined, {
    id: 'demo-user',
    email: 'demo@reputation.local',
    fullName: 'Demo User',
    isActive: true
  })
}
