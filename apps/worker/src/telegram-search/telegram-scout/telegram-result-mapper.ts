import type { MentionType, Platform } from '@prisma/client'
import type {
  HeuristicPreFilterResult,
  MessageClassificationType,
  MessageClassifierResult,
  MessageRoutingResult,
  MessageUrgencyValue,
  TelegramRawMessage
} from './telegram-scout.types'

export interface TelegramMentionMapperInput {
  message: TelegramRawMessage
  matchedQuery: string
  preFilter: HeuristicPreFilterResult
  classification: MessageClassifierResult
  routing: MessageRoutingResult
  companyId: string
  sourceId: string
  companySourceTargetId?: string | null
}

export interface TelegramMentionPersistParams {
  companyId: string
  sourceId: string
  platform: Platform
  type: MentionType
  externalMentionId: string
  url: string | null
  title: string | null
  content: string
  author: string | null
  authorExternalId: string | null
  publishedAt: Date
  companySourceTargetId?: string | null
  matchedQuery: string
  relevanceScore: number
  rawPayload: Record<string, unknown>
  metadata: Record<string, unknown>
  messageClassification: MessageClassificationType | null
  messageClassConfidence: number | null
  messageUrgency: MessageUrgencyValue | null
  messageClassReason: string | null
  messageClassModel: string | null
  isInboxVisible: boolean
  needsManualReview: boolean
  classifiedAt: Date
}

/** Stable regardless of username changes — chatId (numeric) is the durable identity,
 *  never the mutable @username. */
export function buildExternalMentionId(chatId: string, messageId: number): string {
  return `tg:${chatId}:${messageId}`
}

/** Only public sources get a direct link — never a fabricated URL for a source
 *  without a public username. */
export function buildTelegramMessageUrl(username: string | null, messageId: number): string | null {
  return username ? `https://t.me/${username}/${messageId}` : null
}

export function mapTelegramMessageToMentionParams(input: TelegramMentionMapperInput): TelegramMentionPersistParams {
  const { message, preFilter, classification, routing } = input

  const messageClassModel = process.env.YANDEX_GPT_MODEL || 'yandexgpt-lite'

  return {
    companyId: input.companyId,
    sourceId: input.sourceId,
    platform: 'TELEGRAM' as Platform,
    type: 'SOCIAL_MENTION' as MentionType,
    externalMentionId: buildExternalMentionId(message.chatId, message.id),
    url: buildTelegramMessageUrl(message.username, message.id),
    title: message.title,
    content: message.text,
    author: message.authorName,
    authorExternalId: null,
    publishedAt: message.date,
    companySourceTargetId: input.companySourceTargetId ?? null,
    matchedQuery: input.matchedQuery,
    relevanceScore: preFilter.heuristicScore,
    rawPayload: {
      chatId: message.chatId,
      username: message.username,
      title: message.title,
      entityType: message.entityType,
      views: message.views,
      forwards: message.forwards,
      replyCount: message.replyCount,
      reactionsCount: message.reactionsCount,
      authorName: message.authorName,
      date: message.date.toISOString()
    },
    metadata: {
      matchedQuery: input.matchedQuery,
      preFilter: {
        exactHit: preFilter.exactHit,
        heuristicScore: preFilter.heuristicScore,
        heuristicReasons: preFilter.heuristicReasons
      },
      classification: classification.ok
        ? {
            decision: classification.decision,
            type: classification.type,
            sentiment: classification.sentiment,
            urgency: classification.urgency,
            confidence: classification.confidence,
            shortReason: classification.shortReason
          }
        : { ok: false, errorReason: classification.errorReason }
    },
    messageClassification: classification.ok ? classification.type : null,
    messageClassConfidence: classification.ok ? classification.confidence : null,
    messageUrgency: classification.ok ? classification.urgency : null,
    messageClassReason: classification.ok ? classification.shortReason : classification.errorReason,
    messageClassModel,
    isInboxVisible: routing.isInboxVisible,
    needsManualReview: routing.needsManualReview,
    classifiedAt: new Date()
  }
}
