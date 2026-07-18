import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Lives outside src/ (apps/worker/.session/), gitignored at the repo root
 * (`apps/worker/.session/`) — this file is a live Telegram credential for a
 * dedicated ReputationOS Telegram account, separate from Growth Engine's own
 * session. Overridable via TELEGRAM_SESSION_PATH.
 */
function sessionPath(): string {
  return process.env.TELEGRAM_SESSION_PATH ?? join(__dirname, '..', '..', '.session', 'telegram-search.session')
}

export function loadSession(): string | null {
  const path = sessionPath()
  return existsSync(path) ? readFileSync(path, 'utf8').trim() : null
}

export function saveSession(sessionString: string): void {
  const path = sessionPath()
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, sessionString, { mode: 0o600 })
}
