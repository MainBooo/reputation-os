import type { Company, CompanyAlias, TelegramDiscoveryMethod } from '@prisma/client'

export type TelegramQueryClass = 'strong' | 'medium' | 'weak'

export interface TelegramQuery {
  text: string
  class: TelegramQueryClass
}

/** telegram-search.processor job modes — see plan §"Режимы агента". */
export type TelegramScoutMode = 'discovery' | 'watchlist' | 'entity_search' | 'source_check'

export type TelegramEntityType = 'channel' | 'group' | 'supergroup'

export type RelevanceVerdict = 'YES' | 'NO' | 'UNSURE'

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

export interface RelevanceInput {
  context: RelevanceContext
  messageText: string
  matchedQuery: string
  sourceTitle: string | null
  sourceUsername: string | null
  /** weak-class matches always go to LLM regardless of heuristic score. */
  isWeakQuery: boolean
}

/** Strict JSON contract returned by the LLM relevance check — see plan. Any parse
 *  failure or schema violation is treated as UNSURE by the caller, never thrown. */
export interface RelevanceLlmResponse {
  decision: RelevanceVerdict
  score: number
  reason: string
  matchedEntity: string
  topic: string
}

export interface RelevanceResult {
  verdict: RelevanceVerdict
  score: number
  reason: string
  matchedEntity?: string | null
  topic?: string | null
  viaLlm: boolean
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
  newChannelsFound: number
  newGroupsFound: number
  stoppedReason: 'exhausted' | 'max_pages' | 'max_messages' | 'max_runtime' | 'empty_page' | 'flood_wait' | 'lock_lost' | null
  floodWaitSeconds?: number
}
