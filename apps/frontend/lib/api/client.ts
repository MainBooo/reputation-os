const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4010'
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

async function getAccessToken() {
  try {
    const { cookies } = await import('next/headers')
    return cookies().get('accessToken')?.value || ''
  } catch {
    return ''
  }
}

async function getToken() {
  return getAccessToken()
}

export async function apiFetch<T>(path: string, options?: RequestInit, fallback?: T): Promise<T> {
  const token = await getToken()

  const response = await fetch(`${API_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    },
    credentials: 'include',
    cache: 'no-store'
  })

  if (!response.ok) {
    if (DEMO_MODE && fallback !== undefined) return fallback
    throw new Error(`API error ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}
