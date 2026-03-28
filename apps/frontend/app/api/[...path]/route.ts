const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://127.0.0.1:4010'

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
  if (authorization) headers.set('authorization', authorization)
  if (cookie) headers.set('cookie', cookie)

  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.text()

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    cache: 'no-store'
  })

  const responseHeaders = new Headers()
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    responseHeaders.set('content-type', upstreamContentType)
  }

  const text = await upstream.text()

  try {
    const data = JSON.parse(text)
    if (data?.accessToken) {
      responseHeaders.append(
        'set-cookie',
        `accessToken=${encodeURIComponent(data.accessToken)}; Path=/; Max-Age=${60 * 60 * 24 * 7}; SameSite=Lax`
      )
    }
  } catch {}

  return new Response(text, {
    status: upstream.status,
    headers: responseHeaders
  })
}

export const GET = handler
export const POST = handler
export const PATCH = handler
export const PUT = handler
export const DELETE = handler
