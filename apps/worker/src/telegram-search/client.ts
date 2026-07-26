import { TelegramClient, errors } from 'teleproto'
import { StringSession } from 'teleproto/sessions'
import { loadSession, saveSession } from './session-store'
import { buildTelegramProxyConfig } from './telegram-proxy.config'

export interface TelegramLoginPrompts {
  phoneNumber: () => Promise<string>
  phoneCode: () => Promise<string>
  /** Only called if the account has 2FA enabled. */
  password?: () => Promise<string>
  onError?: (err: Error) => boolean | void
}

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set — required for Telegram Scout (see TELEGRAM_MONITORING.md)`)
  return value
}

let clientPromise: Promise<TelegramClient> | null = null

/**
 * Singleton MTProto client for the worker process. Dedicated ReputationOS
 * Telegram account/session — never the same live socket as Growth Engine's
 * own Telegram integration. Without `prompts`, a saved session is required;
 * `prompts` is only used by the one-time interactive login script.
 */
export function getTelegramSearchClient(prompts?: TelegramLoginPrompts): Promise<TelegramClient> {
  if (!clientPromise) {
    clientPromise = createClient(prompts).catch((error) => {
      clientPromise = null // don't cache a failed login attempt
      throw error
    })
  }
  return clientPromise
}

/** Safe-to-log proxy fields — never ip/port for a plain direct connection log
 *  (that's not a secret, it's Telegram's own DC), and never username/password/
 *  secret/session string under any circumstances. */
function proxyLogFields(proxy: ReturnType<typeof buildTelegramProxyConfig>): Record<string, unknown> {
  if (!proxy) return { proxyUsed: false }
  return {
    proxyUsed: true,
    proxyType: 'MTProxy' in proxy ? 'mtproxy' : `socks${proxy.socksType}`,
    proxyHost: proxy.ip,
    proxyPort: proxy.port
  }
}

function targetDcOf(client: TelegramClient): number | 'unknown' {
  const dcId = (client.session as unknown as { dcId?: number })?.dcId
  return typeof dcId === 'number' ? dcId : 'unknown'
}

/** One structured log line per connection attempt/outcome — every stage this
 *  client goes through (initial connect, saved-session restore, interactive
 *  login) logs the same shape, so proxy and DC health are visible in one place
 *  without ever printing secrets. The library's own `connectionRetries: 5` retry
 *  loop happens inside a single one of these outer attempts and isn't
 *  individually observable from here without patching the library — this logs
 *  our own call as attempt 1, not each internal sub-retry. */
function logTelegramConnection(fields: {
  stage: 'connect' | 'check_authorization' | 'login'
  proxy: ReturnType<typeof buildTelegramProxyConfig>
  usedSavedSession: boolean
  client: TelegramClient
  attempt: number
  durationMs: number
  outcome: 'ok' | 'session_invalid' | 'error'
  error?: unknown
}): void {
  const payload: Record<string, unknown> = {
    event: 'telegram_connection',
    stage: fields.stage,
    ...proxyLogFields(fields.proxy),
    usedSavedSession: fields.usedSavedSession,
    targetDc: targetDcOf(fields.client),
    attempt: fields.attempt,
    durationMs: fields.durationMs,
    outcome: fields.outcome
  }
  if (fields.error) {
    payload.errorClass = fields.error instanceof Error ? fields.error.constructor.name : 'Unknown'
    payload.errorMessage = fields.error instanceof Error ? fields.error.message : String(fields.error)
  }
  console.log(JSON.stringify(payload))
}

async function createClient(prompts?: TelegramLoginPrompts): Promise<TelegramClient> {
  const apiId = Number(requireEnv('TELEGRAM_API_ID'))
  const apiHash = requireEnv('TELEGRAM_API_HASH')
  const savedSession = loadSession()
  const proxy = buildTelegramProxyConfig()

  // The proxy is passed once, here, at the single factory both the login script
  // and the long-running Scout worker call through (getTelegramSearchClient) —
  // every subsequent connect()/start()/API call this client instance makes goes
  // over the same proxy for its entire lifetime. There is no direct-connection
  // fallback after authentication.
  const client = new TelegramClient(new StringSession(savedSession ?? ''), apiId, apiHash, {
    connectionRetries: 5,
    proxy
  })

  if (savedSession) {
    const connectStartedAt = Date.now()
    try {
      await client.connect()
    } catch (error) {
      logTelegramConnection({
        stage: 'connect',
        proxy,
        usedSavedSession: true,
        client,
        attempt: 1,
        durationMs: Date.now() - connectStartedAt,
        outcome: 'error',
        error
      })
      throw error
    }

    const authorized = await client.checkAuthorization()
    logTelegramConnection({
      stage: 'check_authorization',
      proxy,
      usedSavedSession: true,
      client,
      attempt: 1,
      durationMs: Date.now() - connectStartedAt,
      outcome: authorized ? 'ok' : 'session_invalid'
    })
    if (authorized) return client
    // Saved session exists but is no longer valid (revoked/expired) — falls through to a fresh login below.
  }

  if (!prompts) {
    throw new Error(
      'No valid Telegram Scout session found. Run the one-time interactive login first: ' +
        'pnpm tsx scripts/telegram-search-login.ts'
    )
  }

  const loginStartedAt = Date.now()
  try {
    await client.start({
      phoneNumber: prompts.phoneNumber,
      phoneCode: prompts.phoneCode,
      password:
        prompts.password ??
        (async () => {
          throw new Error('This account has 2FA enabled but no password prompt was provided')
        }),
      onError: (err) => {
        prompts.onError?.(err)
      }
    })
  } catch (error) {
    logTelegramConnection({
      stage: 'login',
      proxy,
      usedSavedSession: false,
      client,
      attempt: 1,
      durationMs: Date.now() - loginStartedAt,
      outcome: 'error',
      error
    })
    throw error
  }

  logTelegramConnection({
    stage: 'login',
    proxy,
    usedSavedSession: false,
    client,
    attempt: 1,
    durationMs: Date.now() - loginStartedAt,
    outcome: 'ok'
  })

  saveSession(client.session.save() as unknown as string)
  return client
}

/**
 * MTProto keeps a live socket open — long-running processes (the worker)
 * must NOT call this during normal operation. Only short-lived scripts
 * (login, smoke tests) should disconnect explicitly.
 */
export async function disconnectTelegramSearchClient(): Promise<void> {
  if (!clientPromise) return
  const client = await clientPromise
  await client.disconnect()
  clientPromise = null
}

/**
 * True for errors meaning "this session is dead, a fresh login is required" —
 * AUTH_KEY_UNREGISTERED/INVALID, SESSION_REVOKED, USER_DEACTIVATED(_BAN), etc.
 * Distinct from FloodWaitError (rate limit, session still valid) and plain
 * network errors (transient, worth retrying with the same session).
 */
export function isSessionInvalidationError(
  error: unknown
): error is InstanceType<typeof errors.UnauthorizedError> {
  return error instanceof errors.UnauthorizedError
}

/**
 * Call after a live client's own API call fails with `isSessionInvalidationError`.
 * `createClient()` only re-validates the session (via `checkAuthorization()`)
 * the FIRST time the singleton is built — once resolved, `clientPromise` is
 * reused forever, so a session that goes bad *after* a successful connect
 * (revoked by Telegram mid-lifetime) was previously never detected: every
 * subsequent job silently reused the same broken client and kept retrying the
 * same doomed API call, and the client's own background update-catch-up loop
 * kept spamming the same AUTH_KEY_UNREGISTERED error indefinitely. Resetting
 * the singleton here forces the next job to rebuild from scratch and go
 * through the normal checkAuthorization()-fails-so-require-login path.
 */
export async function invalidateTelegramSearchClient(): Promise<void> {
  const current = clientPromise
  clientPromise = null
  if (!current) return

  await current
    .then((client) => client.disconnect())
    .catch(() => null)
}
