import { test, expect } from '@playwright/test'
import { POST as proxyPost, GET as proxyGet } from '../app/api/[...path]/route'
import { POST as logoutPost } from '../app/api/auth/logout/route'

test('login proxy stores JWT only in an HttpOnly cookie and strips it from JSON', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ accessToken: 'server-jwt', user: { id: 'user-1' } }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )) as typeof fetch

  try {
    const response = await proxyPost(
      new Request('https://reputation.example/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'qa@example.com', password: 'secret' }),
        headers: { 'content-type': 'application/json' }
      }),
      { params: { path: ['auth', 'login'] } }
    )

    await expect(response.json()).resolves.toEqual({ user: { id: 'user-1' } })
    const cookie = response.headers.get('set-cookie') || ''
    expect(cookie).toContain('accessToken=server-jwt')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('proxy converts the HttpOnly accessToken cookie to a backend Bearer header', async () => {
  const originalFetch = globalThis.fetch
  let forwardedAuthorization = ''
  globalThis.fetch = (async (_input, init) => {
    forwardedAuthorization = new Headers(init?.headers).get('authorization') || ''
    return new Response(JSON.stringify({ id: 'user-1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  }) as typeof fetch

  try {
    const response = await proxyGet(
      new Request('https://reputation.example/api/auth/me', {
        headers: { cookie: 'theme=dark; accessToken=cookie-jwt' }
      }),
      { params: { path: ['auth', 'me'] } }
    )

    expect(response.status).toBe(200)
    expect(forwardedAuthorization).toBe('Bearer cookie-jwt')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('proxy preserves OAuth redirects instead of following them server-side', async () => {
  const originalFetch = globalThis.fetch
  let redirectMode: RequestRedirect | undefined
  globalThis.fetch = (async (_input, init) => {
    redirectMode = init?.redirect
    return new Response(null, {
      status: 302,
      headers: {
        location: 'https://oauth.yandex.ru/authorize',
        'set-cookie': 'yandex_oauth_state=state-1; Path=/api/auth/yandex; HttpOnly; SameSite=Lax'
      }
    })
  }) as typeof fetch

  try {
    const response = await proxyGet(
      new Request('https://reputation.example/api/auth/yandex'),
      { params: { path: ['auth', 'yandex'] } }
    )

    expect(redirectMode).toBe('manual')
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://oauth.yandex.ru/authorize')
    expect(response.headers.get('set-cookie')).toContain('yandex_oauth_state=state-1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('logout expires the HttpOnly cookie server-side', async () => {
  const response = await logoutPost()
  const cookie = response.headers.get('set-cookie') || ''

  expect(response.status).toBe(200)
  expect(cookie).toContain('accessToken=')
  expect(cookie).toContain('Max-Age=0')
  expect(cookie).toContain('HttpOnly')
})
