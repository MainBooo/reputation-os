import { promises as dns } from 'dns'
import * as net from 'net'

// Проверка URL источника (WEB/CUSTOM externalUrl) на этапе создания/обновления —
// быстрый и понятный отказ ДО того, как значение попадёт в БД и будет подхвачено
// воркером. Это не единственная линия защиты: worker делает точно такую же
// проверку заново непосредственно перед каждым server-side запросом (DNS мог
// измениться между созданием источника и фактическим синком — см.
// apps/worker/src/common/security/safe-url.ts, зеркальная копия этого файла).
// Не вынесено в общий пакет — apps/api и apps/worker сейчас не связаны через
// workspace-зависимости, заводить такую связь ради одного файла в разгар
// security-фикса — лишний риск для сборки обоих процессов.

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeUrlError'
  }
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

const FORBIDDEN_HOSTNAME_LITERALS = new Set([
  'localhost',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.goog'
])

function ipv4ToLong(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0)
}

interface CidrV4 {
  base: number
  mask: number
}

function cidrV4(cidr: string): CidrV4 {
  const [base, bitsStr] = cidr.split('/')
  const bits = Number(bitsStr)
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return { base: ipv4ToLong(base) & mask, mask }
}

const FORBIDDEN_V4_RANGES: CidrV4[] = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4'
].map(cidrV4)

function isForbiddenIPv4(ip: string): boolean {
  if (!net.isIPv4(ip)) return true
  const long = ipv4ToLong(ip)
  return FORBIDDEN_V4_RANGES.some(({ base, mask }) => (long & mask) === base)
}

function expandIPv6(ip: string): bigint {
  let addr = ip
  const v4 = addr.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (v4 && net.isIPv4(v4[1])) {
    const long = ipv4ToLong(v4[1])
    const hex1 = ((long >>> 16) & 0xffff).toString(16)
    const hex2 = (long & 0xffff).toString(16)
    addr = addr.slice(0, addr.length - v4[1].length) + hex1 + ':' + hex2
  }

  let head = addr
  let tail = ''
  const hasDouble = addr.includes('::')
  if (hasDouble) {
    const idx = addr.indexOf('::')
    head = addr.slice(0, idx)
    tail = addr.slice(idx + 2)
  }
  const headParts = head ? head.split(':').filter(Boolean) : []
  const tailParts = tail ? tail.split(':').filter(Boolean) : []

  let hextets: string[]
  if (hasDouble) {
    const missing = 8 - headParts.length - tailParts.length
    hextets = [...headParts, ...Array(Math.max(missing, 0)).fill('0'), ...tailParts]
  } else {
    hextets = addr.split(':')
  }

  return hextets.reduce((acc, h) => (acc << 16n) + BigInt(parseInt(h || '0', 16) || 0), 0n)
}

function ipv6CidrMatch(addr: bigint, prefixIp: string, prefixLen: number): boolean {
  const prefixAddr = expandIPv6(prefixIp)
  const shift = 128n - BigInt(prefixLen)
  return addr >> shift === prefixAddr >> shift
}

function isForbiddenIPv6(ip: string): boolean {
  if (!net.isIPv6(ip)) return true
  const addr = expandIPv6(ip)

  if (addr === 0n) return true
  if (addr === 1n) return true

  if (ipv6CidrMatch(addr, '::ffff:0:0', 96)) {
    const v4long = Number(addr & 0xffffffffn)
    const a = (v4long >>> 24) & 0xff
    const b = (v4long >>> 16) & 0xff
    const c = (v4long >>> 8) & 0xff
    const d = v4long & 0xff
    return isForbiddenIPv4(`${a}.${b}.${c}.${d}`)
  }

  if (ipv6CidrMatch(addr, 'fc00::', 7)) return true
  if (ipv6CidrMatch(addr, 'fe80::', 10)) return true
  if (ipv6CidrMatch(addr, 'ff00::', 8)) return true
  if (ipv6CidrMatch(addr, '2001:db8::', 32)) return true
  if (ipv6CidrMatch(addr, '64:ff9b::', 96)) return true

  return false
}

/**
 * Проверяет, что URL безопасен для server-side запроса: только http/https,
 * без credentials в URL, хост не резолвится (и сам не является) в
 * loopback/private/link-local/multicast/unspecified/cloud-metadata адрес.
 */
export async function assertSafeExternalUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new UnsafeUrlError('Invalid URL')
  }

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new UnsafeUrlError(`Protocol not allowed: ${parsed.protocol}`)
  }

  if (parsed.username || parsed.password) {
    throw new UnsafeUrlError('URL must not contain credentials')
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!hostname) {
    throw new UnsafeUrlError('Empty hostname')
  }

  if (FORBIDDEN_HOSTNAME_LITERALS.has(hostname) || hostname.endsWith('.localhost')) {
    throw new UnsafeUrlError('Hostname not allowed')
  }

  if (net.isIPv4(hostname)) {
    if (isForbiddenIPv4(hostname)) throw new UnsafeUrlError('IP address not allowed')
    return parsed
  }

  if (net.isIPv6(hostname)) {
    if (isForbiddenIPv6(hostname)) throw new UnsafeUrlError('IP address not allowed')
    return parsed
  }

  let addresses: { address: string; family: number }[]
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new UnsafeUrlError('Hostname could not be resolved')
  }

  if (!addresses.length) {
    throw new UnsafeUrlError('Hostname could not be resolved')
  }

  for (const { address, family } of addresses) {
    const forbidden = family === 6 ? isForbiddenIPv6(address) : isForbiddenIPv4(address)
    if (forbidden) {
      throw new UnsafeUrlError('Hostname resolves to a disallowed address')
    }
  }

  return parsed
}

export async function isSafeExternalUrl(rawUrl: string): Promise<boolean> {
  try {
    await assertSafeExternalUrl(rawUrl)
    return true
  } catch {
    return false
  }
}
