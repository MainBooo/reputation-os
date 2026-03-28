const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function getBrowserToken() {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('accessToken') || ''
}

async function getServerToken() {
  if (typeof window !== 'undefined') return ''

  try {
    const headersModule = await import('next/headers')
    return headersModule.cookies().get('accessToken')?.value || ''
  } catch {
    return ''
  }
}

async function getToken() {
  return typeof window === 'undefined' ? getServerToken() : getBrowserToken()
}

export async function apiFetch<T>(path: string, options?: RequestInit, fallback?: T): Promise<T> {
  const token = await getToken()

  try {
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
      if (fallback !== undefined) return fallback
      throw new Error(`API error ${response.status}`)
    }

    if (response.status === 204) return undefined as T
    return response.json()
  } catch (error) {
    if (DEMO_MODE && fallback !== undefined) return fallback
    throw error
  }
}
