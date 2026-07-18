import { errors } from 'teleproto'

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** FloodWaitError is never retried here — the caller decides how to react
 *  (stop pagination, mark the run PARTIAL) since retrying immediately would
 *  just trigger the same flood limit again. Other transient errors get a
 *  short number of attempts with a linear backoff. */
export async function withRetry<T>(fn: () => Promise<T>, attempts: number, backoffMs = 1000): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      if (error instanceof errors.FloodWaitError) throw error

      lastError = error
      if (attempt < attempts) await delay(backoffMs * attempt)
    }
  }

  throw lastError
}

export function searchDelayMs(): number {
  const raw = Number(process.env.TELEGRAM_SEARCH_DELAY_MS)
  return Number.isFinite(raw) && raw >= 0 ? raw : 1500
}

export function searchRetryAttempts(): number {
  const raw = Number(process.env.TELEGRAM_SEARCH_RETRY_ATTEMPTS)
  return Number.isFinite(raw) && raw > 0 ? raw : 3
}

export function searchResultsLimit(): number {
  const raw = Number(process.env.TELEGRAM_SEARCH_RESULTS_LIMIT)
  return Number.isFinite(raw) && raw > 0 ? raw : 8
}
