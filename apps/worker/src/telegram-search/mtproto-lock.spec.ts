import RedisMock from 'ioredis-mock'
import {
  TELEGRAM_MTPROTO_LOCK_KEY,
  TELEGRAM_MTPROTO_LOCK_TTL_MS,
  TelegramLockLostError,
  withTelegramMtprotoLock
} from './mtproto-lock'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

describe('withTelegramMtprotoLock', () => {
  let redis: any

  beforeEach(async () => {
    // ioredis-mock shares one in-memory store across instances by default
    // (mimicking clients connecting to the same real Redis server) — flush
    // between tests so lock state never leaks from one test to the next.
    redis = new RedisMock()
    await redis.flushall()
  })

  it('acquires the lock and runs fn, returning its result', async () => {
    const result = await withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => 'done')
    expect(result).toEqual({ ok: true, result: 'done' })
  })

  it('sets a real TTL of ~30 seconds (30000ms), not 30000 seconds — PX not EX', async () => {
    const gate = deferred()
    const runPromise = withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => {
      const ttl = await redis.pttl(TELEGRAM_MTPROTO_LOCK_KEY)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(TELEGRAM_MTPROTO_LOCK_TTL_MS)
      expect(ttl).toBeGreaterThan(TELEGRAM_MTPROTO_LOCK_TTL_MS - 5000) // sanity margin, not 30000s
      gate.resolve()
    })
    await gate.promise
    await runPromise
  })

  it('returns lock_busy without throwing when the lock is already held', async () => {
    const first = deferred()
    const release = deferred()

    const firstRun = withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => {
      first.resolve()
      await release.promise
      return 'first-done'
    })

    await first.promise

    const second = await withTelegramMtprotoLock(redis, 'job2', 'discovery', async () => 'second-done')
    expect(second).toEqual({ ok: false, reason: 'lock_busy' })

    release.resolve()
    await expect(firstRun).resolves.toEqual({ ok: true, result: 'first-done' })
  })

  it('releases the lock in finally so a subsequent acquire succeeds', async () => {
    await withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => 'done')
    const exists = await redis.exists(TELEGRAM_MTPROTO_LOCK_KEY)
    expect(exists).toBe(0)

    const second = await withTelegramMtprotoLock(redis, 'job2', 'discovery', async () => 'second')
    expect(second).toEqual({ ok: true, result: 'second' })
  })

  it('heartbeat extends the TTL while fn is still running', async () => {
    jest.useFakeTimers()
    try {
      const gate = deferred()

      const runPromise = withTelegramMtprotoLock(redis, 'job1', 'discovery', async (handle) => {
        // Advance past two heartbeat ticks (10s each) — TTL should stay renewed,
        // never decaying toward 0 the way an un-renewed 30s lock would.
        await jest.advanceTimersByTimeAsync(10_000)
        await jest.advanceTimersByTimeAsync(10_000)

        const ttl = await redis.pttl(TELEGRAM_MTPROTO_LOCK_KEY)
        expect(ttl).toBeGreaterThan(20_000) // would be <=10s left without renewal

        handle.assertHeld() // still holds — must not throw
        gate.resolve()
        return 'ok'
      })

      await gate.promise
      await expect(runPromise).resolves.toEqual({ ok: true, result: 'ok' })
    } finally {
      jest.useRealTimers()
    }
  })

  it('detects the lock being lost (stolen by another process) and reports lock_lost, aborting fn', async () => {
    jest.useFakeTimers()
    try {
      let lockLostSeen = false

      const runPromise = withTelegramMtprotoLock(redis, 'job1', 'discovery', async (handle) => {
        // Simulate another process forcefully taking over the key mid-flight —
        // the next heartbeat's compare-and-PEXPIRE must fail (value mismatch).
        await redis.set(TELEGRAM_MTPROTO_LOCK_KEY, 'someone-elses-token', 'PX', 30_000)

        await jest.advanceTimersByTimeAsync(10_000)
        await jest.advanceTimersByTimeAsync(5) // let the heartbeat promise chain settle

        try {
          handle.assertHeld()
        } catch (error) {
          lockLostSeen = true
          throw error
        }

        return 'should-not-reach-here'
      })

      const result = await runPromise
      expect(result).toEqual({ ok: false, reason: 'lock_lost' })
      expect(lockLostSeen).toBe(true)
    } finally {
      jest.useRealTimers()
    }
  })

  it('never deletes a lock now owned by someone else (compare-and-delete)', async () => {
    const gate = deferred()

    const runPromise = withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => {
      gate.resolve()
      // Between our fn finishing and the finally-block release firing, pretend the
      // TTL already expired naturally and another process grabbed the key.
      await redis.set(TELEGRAM_MTPROTO_LOCK_KEY, 'foreign-token', 'PX', 30_000)
      return 'done'
    })

    await gate.promise
    await runPromise

    const value = await redis.get(TELEGRAM_MTPROTO_LOCK_KEY)
    expect(value).toBe('foreign-token') // our release must not have deleted it
  })

  it('wraps a TelegramLockLostError thrown by fn into a lock_lost result, not an exception', async () => {
    await expect(
      withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => {
        throw new TelegramLockLostError()
      })
    ).resolves.toEqual({ ok: false, reason: 'lock_lost' })
  })

  it('propagates a non-lock error from fn instead of swallowing it', async () => {
    await expect(
      withTelegramMtprotoLock(redis, 'job1', 'discovery', async () => {
        throw new Error('domain error')
      })
    ).rejects.toThrow('domain error')

    // Lock must still be released even when fn throws a regular error.
    const exists = await redis.exists(TELEGRAM_MTPROTO_LOCK_KEY)
    expect(exists).toBe(0)
  })
})
