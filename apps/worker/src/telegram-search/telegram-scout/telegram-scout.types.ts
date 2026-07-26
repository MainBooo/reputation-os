import type { Company, CompanyAlias, TelegramDiscoveryMethod } from '@prisma/client'

export type TelegramQueryClass = 'strong' | 'medium' | 'weak'

export interface TelegramQuery {
  text: string
  class: TelegramQueryClass
}

/** telegram-search.processor job modes — see plan §"Режимы агента". */
export type TelegramScoutMode = 'discovery' | 'watchlist' | 'entity_search' | 'source_check'

export type TelegramEntityType = 'channel' | 'group' | 'supergroup'

export interface RelevanceContext {
  companyName: string
  normalizedCompanyName: string
  website: string | null
  domain: string | null
  /** Non-excluded aliases only — matching signal. */
  aliases: string[]
  /** isPrimary && !isExcluded — the "сильный alias" used for the step-2 exact-match check. */
  primaryAliases: string[]
  /** CompanyAlias.isExcluded=true — presence suppresses a match, never confirms one. */
  excludedTerms: string[]
  city: string | null
  industry: string | null
}

/** Cheap, LLM-free structural filter. `passesPreFilter=false` means the message
 *  never reaches the meaning classifier at all — either an excluded term matched
 *  (hard suppressor) or there is no token/city overlap whatsoever (zero signal).
 *  Everything else, including what used to be the `exactHit` shortcut, must go
 *  through TelegramMessageClassifierService — this is not a content decision. */
export interface HeuristicPreFilterResult {
  passesPreFilter: boolean
  hardRejectReason?: string
  exactHit: boolean
  heuristicScore: number
  heuristicReasons: string[]
}

export type MessageClassifierDecision = 'YES' | 'NO' | 'UNSURE'

export type MessageClassificationType =
  | 'OWNED_PROMO'
  | 'CUSTOMER_REVIEW'
  | 'CUSTOMER_COMPLAINT'
  | 'CUSTOMER_QUESTION'
  | 'CHAT_DISCUSSION'
  | 'NEWS_MENTION'
  | 'IRRELEVANT'
  | 'SPAM'

export type MessageSentimentValue = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'

export type MessageUrgencyValue = 'LOW' | 'MEDIUM' | 'HIGH'

/** Input to TelegramMessageClassifierService.classify() — deliberately excludes
 *  author name/username/authorExternalId (plan §"Минимизация данных в промпте");
 *  `channelClassification` is a placeholder for Этап 2 (Channel Classifier), always
 *  null until that stage exists. */
export interface MessageClassifierInput {
  context: RelevanceContext
  messageText: string
  matchedQuery: string
  channelTitle: string | null
  channelUsername: string | null
  entityType: TelegramEntityType
  channelClassification: string | null
  exactHit: boolean
}

/** Discriminated union — `ok:false` is a technical failure (network error, timeout,
 *  invalid JSON, unknown enum value, out-of-range/non-numeric confidence, empty
 *  response), never a content judgement. Callers must never lose the Mention on
 *  `ok:false` — see resolveMessageRouting. */
export type MessageClassifierResult =
  | {
      ok: true
      decision: MessageClassifierDecision
      type: MessageClassificationType
      sentiment: MessageSentimentValue
      urgency: MessageUrgencyValue
      confidence: number
      shortReason: string
    }
  | {
      ok: false
      errorReason: string
    }

export interface MessageRoutingResult {
  isInboxVisible: boolean
  needsManualReview: boolean
}

/** One raw message as returned by teleproto, normalized just enough for the
 *  relevance/result-mapper stages — never the raw library object beyond this shape. */
export interface TelegramRawMessage {
  id: number
  chatId: string
  /** Present only for public channels/groups — never fabricated. */
  username: string | null
  title: string | null
  entityType: TelegramEntityType
  text: string
  date: Date
  views: number | null
  forwards: number | null
  replyCount: number | null
  reactionsCount: number | null
  authorName: string | null
}

export interface TelegramScoutBudgets {
  maxQueriesPerCompany: number
  maxStrongQueries: number
  maxMediumQueries: number
  maxWeakQueries: number
  maxPagesPerQuery: number
  maxMessagesPerRun: number
  maxNewSourcesPerRun: number
  maxRuntimeMs: number
}

export interface CompanyScoutInput {
  company: Company
  aliases: CompanyAlias[]
}

export interface DiscoverySourceCandidate {
  chatId: string
  username: string | null
  title: string | null
  entityType: TelegramEntityType
  discoveryMethod: TelegramDiscoveryMethod
  matchedQuery: string
}

/** Aggregated run statistics persisted into JobLog.result (structured metadata
 *  JSON — no dedicated table; see JobLogService). Every field here is meant to
 *  be independently inspectable, not folded into one summary line. */
export interface TelegramScoutRunStats {
  mode: TelegramScoutMode
  companyId?: string
  /** queryBuilder.build() output, captured before the search loop runs — the
   *  full planned set regardless of whether the run later stops early. */
  queriesPlanned: number
  /** Queries actually attempted this run — equals queriesPlanned unless the
   *  run stopped early (max_runtime/max_messages/flood_wait). */
  queriesExecuted: Array<{ text: string; class: TelegramQueryClass }>
  pagesFetched: number
  /** Raw candidate-channel hits this run, counted before collapsing to unique
   *  chatId (i.e. before the same channel dedup that channelsFoundUnique reflects). */
  channelsFoundTotal: number
  /** Distinct chatIds found this run (global search + entity search + deep
   *  search), after dedup — same channel hit via two different queries counts once. */
  channelsFoundUnique: number
  messagesScanned: number
  /** Passed the heuristic pre-filter and were sent on to AI classification —
   *  distinct from messagesScanned (includes hard-rejected messages) and from
   *  messagesClassified (an AI call can still fail technically). */
  candidateMessages: number
  /** classifier.classify() was actually invoked (ok:true or ok:false). */
  messagesClassified: number
  /** classifier.classify() succeeded AND decision !== 'NO' — a genuine positive
   *  signal, not just "survived the pre-filter". */
  relevantMessages: number
  /** Every message that passed the pre-filter is persisted as a Mention
   *  (audit principle — see evaluateMessages) — mentionsCreated + duplicatesSkipped
   *  always equals this. Kept for backward compatibility with existing consumers. */
  mentionsConfirmed: number
  /** persistMention() resolved to a brand-new Mention row. */
  mentionsCreated: number
  /** persistMention() matched an existing Mention (externalMentionId/hash/
   *  author+content fallback) and merged into it instead of creating a new row. */
  duplicatesSkipped: number
  mentionsRejected: number
  mentionsUnsure: number
  /** confidence >= hideThreshold && type in {OWNED_PROMO, IRRELEVANT, SPAM} — isInboxVisible=false. */
  mentionsHidden: number
  /** confidence < reviewThreshold, or a technical classifier failure — needsManualReview=true. */
  mentionsNeedReview: number
  newChannelsFound: number
  newGroupsFound: number
  /** Already-enabled CompanyTelegramChannel rows checked via the cursor-based
   *  watchlist path at the end of this same daily run — replaces the old
   *  standalone 5-15min dispatcher (see plan: "один суточный проход"). Covers
   *  every enabled channel, not a sample — a channel is only skipped here if it
   *  was already deep-searched as a fresh candidate earlier in the same run. */
  watchlistChannelsChecked: number
  watchlistMentionsFound: number
  /** Technical Telegram API failures this run: FloodWait occurrences plus
   *  per-message errors surfaced by the watchlist phase (WatchlistProcessResult.errors).
   *  Silently-logged-only failures (e.g. a single username resolve retry) are not
   *  counted here — only ones that actually interrupted or skipped real work. */
  telegramApiErrors: number
  /** classifier.classify() returned ok:false — a technical failure (network,
   *  timeout, bad response shape), never a content judgement. The message is
   *  still persisted (needsManualReview), but was NOT successfully classified. */
  aiClassificationErrors: number
  stoppedReason: 'exhausted' | 'max_pages' | 'max_messages' | 'max_runtime' | 'empty_page' | 'flood_wait' | 'lock_lost' | null
  floodWaitSeconds?: number
}
