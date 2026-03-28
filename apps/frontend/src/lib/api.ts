import { cookies } from 'next/headers'

export async function apiFetch(url: string, options: RequestInit = {}) {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('accessToken')?.value

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${url}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    })

    if (res.status === 401) {
      return null
    }

    if (!res.ok) {
      return null
    }

    return await res.json()
  } catch (e) {
    return null
  }
}
