const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4010'
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function readTokenFromBrowser() {
  if (typeof window === 'undefined') return ''

  const cookieToken = document.cookie
    .split('; ')
    .find((row) => row.startsWith('accessToken='))
    ?.split('=')[1]

  if (cookieToken) return decodeURIComponent(cookieToken)

  try {
    return localStorage.getItem('accessToken') || ''
  } catch {
    return ''
  }
}

async function readTokenFromServer() {
  try {
    const { cookies } = await import('next/headers')
    return cookies().get('accessToken')?.value || ''
  } catch {
    return ''
  }
}

async function getToken() {
  if (typeof window !== 'undefined') {
    return readTokenFromBrowser()
  }

  return readTokenFromServer()
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
    if ((response.status === 401 || response.status === 403) && fallback !== undefined) {
      return fallback
    }

    if (DEMO_MODE && fallback !== undefined) return fallback

    let message = `API error ${response.status}`
    try {
      const data = await response.json()
      if (typeof data?.message === 'string') {
        message = data.message
      } else if (Array.isArray(data?.message) && data.message.length) {
        message = String(data.message[0])
      }
    } catch {}

    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}
