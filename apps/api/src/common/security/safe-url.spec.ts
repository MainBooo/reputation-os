import { promises as dnsPromises } from 'dns'

jest.mock('dns', () => ({
  promises: { lookup: jest.fn() }
}))

import { assertSafeExternalUrl, isSafeExternalUrl, UnsafeUrlError } from './safe-url'

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

  it('rejects the localhost hostname', async () => {
    await expect(assertSafeExternalUrl('http://localhost:5432/')).rejects.toThrow(UnsafeUrlError)
    expect(lookupMock).not.toHaveBeenCalled()
  })

  it('rejects a *.localhost hostname', async () => {
    await expect(assertSafeExternalUrl('http://foo.localhost/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a literal loopback IPv4 address', async () => {
    await expect(assertSafeExternalUrl('http://127.0.0.1/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a literal ::1 IPv6 loopback address', async () => {
    await expect(assertSafeExternalUrl('http://[::1]/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects private IPv4 ranges (10.x, 172.16-31.x, 192.168.x)', async () => {
    await expect(assertSafeExternalUrl('http://10.0.0.5/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://172.20.1.1/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://192.168.1.1/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects link-local addresses including the cloud metadata endpoint', async () => {
    await expect(assertSafeExternalUrl('http://169.254.1.1/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects 0.0.0.0', async () => {
    await expect(assertSafeExternalUrl('http://0.0.0.0/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects URLs containing credentials', async () => {
    mockDns([{ address: '93.184.216.34', family: 4 }])
    await expect(assertSafeExternalUrl('http://user:pass@example.com/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects disallowed schemes', async () => {
    await expect(assertSafeExternalUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('ftp://example.com/x')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('data:text/plain;base64,aGVsbG8=')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('javascript:alert(1)')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('blob:https://example.com/uuid')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects a hostname whose DNS lookup resolves to a private IP', async () => {
    mockDns([{ address: '10.1.2.3', family: 4 }])
    await expect(assertSafeExternalUrl('http://internal.example.com/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects when DNS returns a mix of public and private addresses (rebinding-style answer)', async () => {
    mockDns([
      { address: '93.184.216.34', family: 4 },
      { address: '127.0.0.1', family: 4 }
    ])
    await expect(assertSafeExternalUrl('http://mixed.example.com/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects an IPv4-mapped IPv6 literal pointing at a private address', async () => {
    await expect(assertSafeExternalUrl('http://[::ffff:127.0.0.1]/')).rejects.toThrow(UnsafeUrlError)
    await expect(assertSafeExternalUrl('http://[::ffff:192.168.1.1]/')).rejects.toThrow(UnsafeUrlError)
  })

  it('rejects when the hostname cannot be resolved', async () => {
    lookupMock.mockRejectedValue(new Error('ENOTFOUND'))
    await expect(assertSafeExternalUrl('http://does-not-exist.invalid/')).rejects.toThrow(UnsafeUrlError)
  })

  it('isSafeExternalUrl returns a boolean instead of throwing', async () => {
    mockDns([{ address: '10.0.0.1', family: 4 }])
    await expect(isSafeExternalUrl('http://internal.example.com/')).resolves.toBe(false)

    mockDns([{ address: '93.184.216.34', family: 4 }])
    await expect(isSafeExternalUrl('https://example.com/')).resolves.toBe(true)
  })
})
