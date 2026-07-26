import type { ProxyInterface } from 'teleproto/network/connection/TCPMTProxy'

/**
 * Optional SOCKS5/SOCKS4/MTProxy egress for the Telegram Scout MTProto client —
 * used both by the one-time interactive login script and by the long-running
 * worker client (both go through `getTelegramSearchClient()` in client.ts), so
 * configuring it here covers login and normal Scout operation identically.
 *
 * Unset `TELEGRAM_PROXY_TYPE` (the default) disables the proxy entirely and
 * preserves today's direct-connection behavior.
 */
export function buildTelegramProxyConfig(): ProxyInterface | undefined {
  const type = process.env.TELEGRAM_PROXY_TYPE?.trim().toLowerCase()
  if (!type) return undefined

  const ip = process.env.TELEGRAM_PROXY_IP?.trim()
  const portRaw = process.env.TELEGRAM_PROXY_PORT?.trim()
  const port = portRaw ? Number(portRaw) : NaN

  if (!ip || !Number.isFinite(port)) {
    throw new Error(
      'TELEGRAM_PROXY_TYPE is set but TELEGRAM_PROXY_IP/TELEGRAM_PROXY_PORT are missing or invalid — ' +
        'set both, or unset TELEGRAM_PROXY_TYPE to disable the proxy.'
    )
  }

  const timeoutRaw = process.env.TELEGRAM_PROXY_TIMEOUT_SEC?.trim()
  const timeout = timeoutRaw ? Number(timeoutRaw) : undefined
  const username = process.env.TELEGRAM_PROXY_USERNAME?.trim() || undefined
  const password = process.env.TELEGRAM_PROXY_PASSWORD?.trim() || undefined

  if (type === 'mtproxy') {
    const secret = process.env.TELEGRAM_PROXY_SECRET?.trim()
    if (!secret) {
      throw new Error('TELEGRAM_PROXY_TYPE=mtproxy requires TELEGRAM_PROXY_SECRET')
    }
    return { MTProxy: true, ip, port, secret, timeout: Number.isFinite(timeout) ? timeout : undefined }
  }

  if (type === 'socks5' || type === 'socks4') {
    return {
      socksType: type === 'socks5' ? 5 : 4,
      ip,
      port,
      timeout: Number.isFinite(timeout) ? timeout : undefined,
      username,
      password
    }
  }

  throw new Error(`Unknown TELEGRAM_PROXY_TYPE=${type} — expected "socks5", "socks4" or "mtproxy"`)
}
