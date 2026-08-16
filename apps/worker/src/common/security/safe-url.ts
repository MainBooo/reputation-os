import { promises as dns } from 'dns'
import * as net from 'net'

// Централизованная защита от SSRF для всех server-side запросов по
// пользовательским URL (WEB-мониторинг, Яндекс/2ГИС Playwright-навигация).
// Используется:
//  1. непосредственно перед КАЖДЫМ исходящим запросом/навигацией;
//  2. после КАЖДОГО redirect — Location проверяется заново, автослежение
//     за редиректами отключено (redirect: 'manual' в safeFetch).
//
// Зеркальная копия есть в apps/api/src/common/security/safe-url.ts
// (используется на create/update источника — тот же список правил).
// Не вынесено в общий пакет намеренно: apps/api и apps/worker сейчас не
// связаны через workspace-зависимости, а заводить такую связь ради одного
// файла в разгар security-фикса — лишний риск для сборки обоих процессов.

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

// IANA special-purpose IPv4 registry — всё, что не является обычным публичным
// адресом. 169.254.169.254 (облачные metadata-эндпоинты) покрывается 169.254.0.0/16.
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
  if (!net.isIPv4(ip)) return true // не смогли распарсить как IPv4 — считаем небезопасным
  const long = ipv4ToLong(ip)
  return FORBIDDEN_V4_RANGES.some(({ base, mask }) => (long & mask) === base)
}

// Разворачивает IPv6-адрес (включая "::" сокращение и embedded IPv4, напр.
// "::ffff:127.0.0.1") в 128-битное целое для сравнения по префиксу.
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

  if (addr === 0n) return true // ::
  if (addr === 1n) return true // ::1 loopback

  if (ipv6CidrMatch(addr, '::ffff:0:0', 96)) {
    // IPv4-mapped IPv6 — размотать и перепроверить как IPv4
    const v4long = Number(addr & 0xffffffffn)
    const a = (v4long >>> 24) & 0xff
    const b = (v4long >>> 16) & 0xff
    const c = (v4long >>> 8) & 0xff
    const d = v4long & 0xff
    return isForbiddenIPv4(`${a}.${b}.${c}.${d}`)
  }

  if (ipv6CidrMatch(addr, 'fc00::', 7)) return true // unique local (private)
  if (ipv6CidrMatch(addr, 'fe80::', 10)) return true // link-local
  if (ipv6CidrMatch(addr, 'ff00::', 8)) return true // multicast
  if (ipv6CidrMatch(addr, '2001:db8::', 32)) return true // documentation
  if (ipv6CidrMatch(addr, '64:ff9b::', 96)) return true // NAT64 (может встраивать IPv4)

  return false
}

/**
 * Проверяет, что URL безопасен для server-side запроса: только http/https,
 * без credentials в URL, хост не резолвится (и сам не является) в
 * loopback/private/link-local/multicast/unspecified/cloud-metadata адрес.
 * Резолвит DNS и проверяет КАЖДЫЙ полученный адрес (защита от смешанного
 * public+private ответа и DNS rebinding — форма, полученная на шаге создания
 * источника, могла измениться к моменту запроса).
 *
 * Бросает UnsafeUrlError с понятной причиной вместо булева результата —
 * вызывающий код (DTO-валидатор, safeFetch, pre-navigation guard) сам решает,
 * как это отразить пользователю/логам.
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

export const SAFE_FETCH_USER_AGENT = 'Mozilla/5.0 (compatible; ReputationOS-WebMonitor/1.0; +https://reputation.generationweb.ru)'

const MAX_REDIRECTS = 5
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024 // 5MB — с запасом достаточно для HTML-страницы

async function readBodyWithLimit(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return response.text()

  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      received += value.byteLength
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined)
        throw new UnsafeUrlError('Response too large')
      }
      chunks.push(value)
    }
  }

  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf-8')
}

export interface SafeFetchResult {
  status: number
  ok: boolean
  headers: Headers
  text: () => Promise<string>
}

/**
 * fetch() с SSRF-защитой: валидирует URL и КАЖДЫЙ redirect Location заново
 * (redirect: 'manual', авто-следование выключено), ограничивает число хопов,
 * таймаут и максимальный размер тела ответа. Используется вместо голого
 * fetch(url) везде, где url приходит от пользователя (WatchedPage.url).
 */
export async function safeFetch(
  rawUrl: string,
  init: { headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<SafeFetchResult> {
  let currentUrl = rawUrl
  const timeoutMs = init.timeoutMs ?? 15000

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const validated = await assertSafeExternalUrl(currentUrl)

    const response = await fetch(validated.toString(), {
      headers: { 'User-Agent': SAFE_FETCH_USER_AGENT, ...init.headers },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs)
    })

    const isRedirect = response.status >= 300 && response.status < 400
    const location = response.headers.get('location')

    if (isRedirect && location) {
      if (hop === MAX_REDIRECTS) {
        throw new UnsafeUrlError('Too many redirects')
      }
      // Location может быть относительным — резолвим от текущего URL.
      currentUrl = new URL(location, validated).toString()
      continue
    }

    const bodyText = await readBodyWithLimit(response, MAX_RESPONSE_BYTES)

    return {
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      text: async () => bodyText
    }
  }

  throw new UnsafeUrlError('Too many redirects')
}
