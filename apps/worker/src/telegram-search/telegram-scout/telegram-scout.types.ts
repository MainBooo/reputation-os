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

/** Aggregated run statistics persisted into JobLog.result — no dedicated table. */
export interface TelegramScoutRunStats {
  mode: TelegramScoutMode
  companyId?: string
  queriesExecuted: Array<{ text: string; class: TelegramQueryClass }>
  pagesFetched: number
  messagesScanned: number
  mentionsConfirmed: number
  mentionsRejected: number
  mentionsUnsure: number
  /** confidence >= hideThreshold && type in {OWNED_PROMO, IRRELEVANT, SPAM} — isInboxVisible=false. */
  mentionsHidden: number
  /** confidence < reviewThreshold, or a technical classifier failure — needsManualReview=true. */
  mentionsNeedReview: number
  newChannelsFound: number
  newGroupsFound: number
  stoppedReason: 'exhausted' | 'max_pages' | 'max_messages' | 'max_runtime' | 'empty_page' | 'flood_wait' | 'lock_lost' | null
  floodWaitSeconds?: number
}
