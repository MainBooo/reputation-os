const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:4010'

function readCookie(header: string | null, name: string) {
  if (!header) return ''
  const item = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))
  if (!item) return ''
  try {
    return decodeURIComponent(item.slice(name.length + 1))
  } catch {
    return ''
  }
}

async function handler(
  request: Request,
  context: { params: { path: string[] } }
) {
  const path = Array.isArray(context.params.path) ? context.params.path.join('/') : ''
  const url = new URL(request.url)
  const upstreamUrl = `${BACKEND_URL}/api/${path}${url.search}`

  const headers = new Headers()
  const contentType = request.headers.get('content-type')
  const authorization = request.headers.get('authorization')
  const cookie = request.headers.get('cookie')

  if (contentType) headers.set('content-type', contentType)
  const cookieToken = readCookie(cookie, 'accessToken')
  if (authorization) headers.set('authorization', authorization)
  else if (cookieToken) headers.set('authorization', `Bearer ${cookieToken}`)
  if (cookie) headers.set('cookie', cookie)

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text()

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual'
  })

  const responseHeaders = new Headers()
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType)
  }

  const location = upstream.headers.get('location')
  if (location) responseHeaders.set('location', location)

  const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] }
  const upstreamCookies = upstreamHeaders.getSetCookie?.() ?? []
  for (const value of upstreamCookies) responseHeaders.append('set-cookie', value)

  const text = await upstream.text()
  let responseBody = text

  try {
    const data = JSON.parse(text)
    if (data?.accessToken) {
      const secure = new URL(request.url).protocol === 'https:' || process.env.NODE_ENV === 'production'
      responseHeaders.append(
        'set-cookie',
        `accessToken=${encodeURIComponent(data.accessToken)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`
      )
      delete data.accessToken
      responseBody = JSON.stringify(data)
    }
  } catch {}

  return new Response(responseBody, {
    status: upstream.status,
    headers: responseHeaders
  })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler
