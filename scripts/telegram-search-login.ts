import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { existsSync as envExists, readFileSync as readEnvFile } from 'node:fs'
import { resolve } from 'node:path'
import {
  disconnectTelegramSearchClient,
  getTelegramSearchClient
} from '../apps/worker/src/telegram-search/client'

/**
 * One-time interactive login for the dedicated ReputationOS Telegram Scout
 * account. Run standalone, never as part of a normal worker boot — a phone
 * number/SMS code/2FA password can't be scripted, so this coordinates with
 * whoever is driving the process (human or agent) through plain files
 * rather than real stdin, since this may run in the background with no
 * attached terminal.
 *
 * Protocol: writes `<COORDINATION_DIR>/waiting-for.txt` with one of
 * "phone" | "code" | "password", then polls for the matching answer file
 * (`phone.txt` / `code.txt` / `password.txt`), reads it, deletes it, and
 * proceeds.
 *
 * This is a manual, explicitly-confirmed operation — it creates a real
 * Telegram session and must not be run against production without a
 * separate go-ahead.
 */
const COORDINATION_DIR =
  process.env.TELEGRAM_LOGIN_COORDINATION_DIR ??
  resolve(__dirname, '../apps/worker/.session/login-coordination')
const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS = 10 * 60_000

function loadEnvFile(path: string): void {
  if (!envExists(path)) return
  for (const line of readEnvFile(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (!(key in process.env)) process.env[key] = value
  }
}

async function waitForAnswer(kind: 'phone' | 'code' | 'password'): Promise<string> {
  const answerPath = resolve(COORDINATION_DIR, `${kind}.txt`)
  writeFileSync(resolve(COORDINATION_DIR, 'waiting-for.txt'), kind)
  console.log(`[telegram-search-login] Waiting for ${kind} — write it to ${answerPath}`)

  const deadline = Date.now() + POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (existsSync(answerPath)) {
      const value = readFileSync(answerPath, 'utf8').trim()
      rmSync(answerPath)
      return value
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }
  throw new Error(`Timed out waiting for ${kind} after ${POLL_TIMEOUT_MS / 1000}s`)
}

async function main() {
  loadEnvFile(resolve(__dirname, '../apps/worker/.env'))
  loadEnvFile(resolve(__dirname, '../.env'))
  mkdirSync(COORDINATION_DIR, { recursive: true })

  await getTelegramSearchClient({
    phoneNumber: () => waitForAnswer('phone'),
    phoneCode: () => waitForAnswer('code'),
    password: () => waitForAnswer('password'),
    onError: (err) => console.error('[telegram-search-login] error during login:', err.message)
  })

  writeFileSync(resolve(COORDINATION_DIR, 'waiting-for.txt'), 'done')
  console.log('[telegram-search-login] Success — session saved.')
}

main()
  .catch((error) => {
    console.error('[telegram-search-login] Failed:', error)
    process.exitCode = 1
  })
  .finally(() => disconnectTelegramSearchClient())
