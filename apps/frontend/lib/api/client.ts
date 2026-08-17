const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:4010'

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

function getApiBase() {
  if (typeof window !== 'undefined') {
    return ''
  }
  return SERVER_API_URL
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
  // Browser requests authenticate through the HttpOnly cookie. The same-origin
  // Next proxy converts it to the backend Bearer header without exposing JWT to JS.
  if (typeof window !== 'undefined') return ''
  return readTokenFromServer()
}

export async function apiFetch<T>(path: string, options?: RequestInit, fallback?: T): Promise<T> {
  const token = await getToken()
  const base = getApiBase()

  const response = await fetch(`${base}/api${path}`, {
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

    let message = `API error ${response.status}`
    try {
      const data = await response.json()
      if (typeof data?.message === 'string') {
        message = data.message
      } else if (Array.isArray(data?.message) && data.message.length) {
        message = String(data.message[0])
      } else if (typeof data?.code === 'string') {
        message = data.code
      }
    } catch {}

    const error = new Error(message) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}

export function isApiError(error: unknown, status: number): boolean {
  return error instanceof Error && (error as Error & { status?: number }).status === status
}
