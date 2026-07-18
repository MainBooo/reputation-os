import { TelegramClient } from 'teleproto'
import { StringSession } from 'teleproto/sessions'
import { loadSession, saveSession } from './session-store'

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

async function createClient(prompts?: TelegramLoginPrompts): Promise<TelegramClient> {
  const apiId = Number(requireEnv('TELEGRAM_API_ID'))
  const apiHash = requireEnv('TELEGRAM_API_HASH')
  const savedSession = loadSession()

  const client = new TelegramClient(new StringSession(savedSession ?? ''), apiId, apiHash, {
    connectionRetries: 5
  })

  if (savedSession) {
    await client.connect()
    if (await client.checkAuthorization()) return client
    // Saved session exists but is no longer valid (revoked/expired) — falls through to a fresh login below.
  }

  if (!prompts) {
    throw new Error(
      'No valid Telegram Scout session found. Run the one-time interactive login first: ' +
        'pnpm tsx scripts/telegram-search-login.ts'
    )
  }

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
