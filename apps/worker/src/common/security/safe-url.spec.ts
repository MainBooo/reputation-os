import { promises as dnsPromises } from 'dns'

jest.mock('dns', () => ({
  promises: { lookup: jest.fn() }
}))

import { assertSafeExternalUrl, safeFetch, UnsafeUrlError } from './safe-url'

const lookupMock = dnsPromises.lookup as jest.Mock

function mockDns(addresses: { address: string; family: number }[]) {
  lookupMock.mockResolvedValue(addresses)
}

describe('assertSafeExternalUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows a normal public https URL', async () => {
    mockDns([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeExternalUrl('https://example.com/reviews')).resolves.toBeInstanceOf(URL)
  })

  it('allows a normal public http URL', async () => {
    mockDns([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeExternalUrl('http://example.com/reviews')).resolves.toBeInstanceOf(URL)
  })

  it('rejects localhost, loopback and 0.0.0.0', async () => {
    await expect(assertSafeExternalUrl('http://localhost/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://127.0.0.1/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://[::1]/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://0.0.0.0/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects private IPv4 ranges', async () => {
    await expect(assertSafeExternalUrl('http://10.0.0.5/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://172.20.1.1/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://192.168.1.1/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects link-local addresses including the cloud metadata endpoint', async () => {
    await expect(assertSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects URLs with credentials and disallowed schemes', async () => {
    mockDns([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeExternalUrl('http://user:pass@example.com/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('data:text/plain;base64,aGVsbG8=')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a hostname whose DNS lookup resolves to a private IP', async () => {
    mockDns([{ address: '10.1.2.3', family: 4 }])
    await expect(assertSafeExternalUrl('http://internal.example.com/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a mixed public+private DNS answer', async () => {
    mockDns([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ])
    await expect(assertSafeExternalUrl('http://mixed.example.com/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects IPv4-mapped IPv6 literals pointing at private addresses', async () => {
    await expect(assertSafeExternalUrl('http://[::ffff:127.0.0.1]/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://[::ffff:169.254.169.254]/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects when the hostname cannot be resolved', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(assertSafeExternalUrl('http://does-not-exist.invalid/')).rejects.toThrow(UnsafeUrlError)
  })
})

describe('safeFetch', () => {
  let fetchMock: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    mockDns([{ address: '93.184.216.34', family: 4 }])
  })

  function textResponse(status: number, body: string, headers: Record<string, string> = {}) {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(body)
    return {
      status,
      ok: status >= 200 && status < 300,
      headers: new Headers(headers),
      body: {
        getReader: () => {
          let sent = false
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined }
              sent = true
              return { done: false, value: bytes }
            },
            cancel: async () => undefined
          }
        }
      }
    }
  }

  it('fetches a safe public URL successfully', async () => {
    fetchMock.mockResolvedValue(textResponse(200, '<html>ok</html>'))
    const result = await safeFetch('https://example.com/page')
    expect(result.ok).toBe(true)
    await expect(result.text()).resolves.toBe('<html>ok</html>')
  })

  it('rejects when the initial URL is unsafe', async () => {
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeUrlError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows a redirect to another safe public URL', async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(301, '', { location: 'https://example.com/final' }))
      .mockResolvedValueOnce(textResponse(200, 'final page'))

    const result = await safeFetch('https://example.com/start')
    expect(result.ok).toBe(true)
    await expect(result.text()).resolves.toBe('final page')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('rejects a redirect that points at a private IP (SSRF via redirect)', async () => {
    fetchMock.mockResolvedValueOnce(
      textResponse(302, '', { location: 'http://169.254.169.254/latest/meta-data/' })
    )

    await expect(safeFetch('https://example.com/start')).rejects.toThrow(UnsafeUrlError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects a redirect chain that exceeds the max hop count', async () => {
    fetchMock.mockResolvedValue(textResponse(302, '', { location: 'https://example.com/next' }))
    await expect(safeFetch('https://example.com/start')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a response body larger than the size cap', async () => {
    const encoder = new TextEncoder()
    const bigChunk = encoder.encode('x'.repeat(1024 * 1024)) // 1MB per chunk
    let reads = 0
    fetchMock.mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      body: {
        getReader: () => ({
          read: async () => {
            reads += 1
            if (reads > 6) return { done: true, value: undefined } // 6MB > 5MB cap
            return { done: false, value: bigChunk }
          },
          cancel: async () => undefined
        })
      }
    })

    await expect(safeFetch('https://example.com/huge')).rejects.toThrow(UnsafeUrlError)
  })

  it('propagates a timeout as a rejection without crashing the caller', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'))
    await expect(safeFetch('https://example.com/slow', { timeoutMs: 10 })).rejects.toThrow()
  })
})
