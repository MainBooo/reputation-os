import { test, expect } from '@playwright/test'
import { apiFetch } from '../lib/api/client'

test('production 403 is an error and never becomes fallback success', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ message: 'Forbidden' }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  )) as typeof fetch

  try {
    const request = apiFetch('/mentions/mention-1', { method: 'DELETE' }, { ok: true })
    await expect(request).rejects.toMatchObject({ message: 'Forbidden', status: 403 })
  } finally {
    globalThis.fetch = originalFetch
  }
})
