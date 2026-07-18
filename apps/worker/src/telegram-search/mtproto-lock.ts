import type IORedis from 'ioredis'
import { randomUUID } from 'node:crypto'

export const TELEGRAM_MTPROTO_LOCK_KEY = 'reputationos:telegram-mtproto:lock'
export const TELEGRAM_MTPROTO_LOCK_TTL_MS = 30_000
export const TELEGRAM_MTPROTO_LOCK_HEARTBEAT_MS = 10_000

const EXTEND_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
else
  return 0
end
`

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
else
  return 0
end
`

export class TelegramLockLostError extends Error {
  constructor() {
    super('Telegram MTProto lock was lost (TTL expired and lock was re-acquired by another process)')
    this.name = 'TelegramLockLostError'
  }
}

export interface TelegramMtprotoLockHandle {
  /**
   * Throws TelegramLockLostError if the heartbeat has detected the lock is
   * no longer held. Callers MUST call this before each MTProto operation
   * inside a loop — a passed heartbeat does not by itself stop in-flight
   * work from continuing as if it still owned the lock.
   */
  assertHeld(): void
}

export type TelegramMtprotoLockResult<T> =
  | { ok: true; result: T }
  | { ok: false; reason: 'lock_busy' }
  | { ok: false; reason: 'lock_lost' }

/**
 * Distributed guard around the single MTProto socket this process may hold.
 * concurrency:1 on the BullMQ worker only protects a single Node process —
 * this Redis lock is the safety net if apps/worker is ever accidentally run
 * as more than one instance (multiple PM2 processes/containers). A single
 * Telegram Scout worker instance remains the recommended deployment.
 */
export async function withTelegramMtprotoLock<T>(
  redis: IORedis,
  jobId: string,
  mode: string,
  fn: (handle: TelegramMtprotoLockHandle) => Promise<T>
): Promise<TelegramMtprotoLockResult<T>> {
  const token = `${jobId}:${randomUUID()}`

  const acquired = await redis.set(
    TELEGRAM_MTPROTO_LOCK_KEY,
    token,
    'PX',
    TELEGRAM_MTPROTO_LOCK_TTL_MS,
    'NX'
  )

  if (!acquired) {
    console.log(JSON.stringify({ event: 'telegram_mtproto_lock_busy', jobId, mode }))
    return { ok: false, reason: 'lock_busy' }
  }

  let lockLost = false

  const heartbeat = setInterval(() => {
    redis
      .eval(EXTEND_SCRIPT, 1, TELEGRAM_MTPROTO_LOCK_KEY, token, String(TELEGRAM_MTPROTO_LOCK_TTL_MS))
      .then((extended) => {
        if (Number(extended) !== 1) {
          lockLost = true
          console.log(JSON.stringify({ event: 'telegram_mtproto_lock_lost', jobId, mode }))
        }
      })
      .catch((error: unknown) => {
        // Redis hiccup on renewal — safer to assume the lock may be gone than to silently keep acting as owner.
        lockLost = true
        console.log(
          JSON.stringify({
            event: 'telegram_mtproto_lock_lost',
            jobId,
            mode,
            reason: 'heartbeat_error',
            error: error instanceof Error ? error.message : String(error)
          })
        )
      })
  }, TELEGRAM_MTPROTO_LOCK_HEARTBEAT_MS)

  const handle: TelegramMtprotoLockHandle = {
    assertHeld() {
      if (lockLost) throw new TelegramLockLostError()
    }
  }

  try {
    const result = await fn(handle)
    return { ok: true, result }
  } catch (error) {
    if (error instanceof TelegramLockLostError) {
      return { ok: false, reason: 'lock_lost' }
    }
    throw error
  } finally {
    clearInterval(heartbeat)
    await redis.eval(RELEASE_SCRIPT, 1, TELEGRAM_MTPROTO_LOCK_KEY, token).catch(() => null)
  }
}
