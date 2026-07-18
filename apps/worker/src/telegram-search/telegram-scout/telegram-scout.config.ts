import type { TelegramScoutBudgets } from './telegram-scout.types'

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Reads the hard DISCOVERY budgets from ENV on each call — cheap, and lets
 *  tests override process.env per-case without a singleton to reset. */
export function loadTelegramScoutBudgets(): TelegramScoutBudgets {
  return {
    maxQueriesPerCompany: envInt('TELEGRAM_SCOUT_MAX_QUERIES_PER_COMPANY', 6),
    maxStrongQueries: envInt('TELEGRAM_SCOUT_MAX_STRONG_QUERIES', 3),
    maxMediumQueries: envInt('TELEGRAM_SCOUT_MAX_MEDIUM_QUERIES', 2),
    maxWeakQueries: envInt('TELEGRAM_SCOUT_MAX_WEAK_QUERIES', 1),
    maxPagesPerQuery: envInt('TELEGRAM_SCOUT_MAX_PAGES_PER_QUERY', 3),
    maxMessagesPerRun: envInt('TELEGRAM_SCOUT_MAX_MESSAGES_PER_RUN', 300),
    maxNewSourcesPerRun: envInt('TELEGRAM_SCOUT_MAX_NEW_SOURCES_PER_RUN', 15),
    maxRuntimeMs: envInt('TELEGRAM_SCOUT_MAX_RUNTIME_MS', 180_000)
  }
}

export function isHashtagPostSearchEnabled(): boolean {
  return process.env.TELEGRAM_SCOUT_ENABLE_HASHTAG_POST_SEARCH === 'true'
}

export function watchlistMaxMessagesPerChannel(): number {
  return envInt('TELEGRAM_WATCHLIST_MAX_MESSAGES_PER_CHANNEL', 50)
}

export function lockRetryDelayMs(): number {
  return envInt('TELEGRAM_LOCK_RETRY_DELAY_MS', 15_000)
}

export function lockMaxSelfRequeues(): number {
  return envInt('TELEGRAM_LOCK_MAX_SELF_REQUEUES', 5)
}

export function isTelegramScoutEnabled(): boolean {
  return process.env.TELEGRAM_SCOUT_ENABLED === 'true'
}

export function watchlistDispatcherIntervalMin(): number {
  return envInt('TELEGRAM_WATCHLIST_DISPATCHER_INTERVAL_MIN', 5)
}
