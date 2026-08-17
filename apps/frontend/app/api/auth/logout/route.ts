export async function POST() {
  const secure = process.env.NODE_ENV === 'production'
  const cookie = `accessToken=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure ? '; Secure' : ''}`

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': cookie
    }
  })
}
