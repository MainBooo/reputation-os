import { buildExternalMentionId, buildTelegramMessageUrl, mapTelegramMessageToMentionParams } from './telegram-result-mapper'
import type { HeuristicPreFilterResult, MessageClassifierResult, MessageRoutingResult, TelegramRawMessage } from './telegram-scout.types'

function rawMessage(overrides: Partial<TelegramRawMessage> = {}): TelegramRawMessage {
  return {
    id: 42,
    chatId: '999',
    username: 'mychannel',
    title: 'My Channel',
    entityType: 'channel',
    text: 'Были в Кофейне Ромашка, отличный сервис',
    date: new Date('2026-07-18T10:00:00Z'),
    views: 120,
    forwards: 3,
    replyCount: 1,
    reactionsCount: 5,
    authorName: null,
    ...overrides
  }
}

function preFilter(overrides: Partial<HeuristicPreFilterResult> = {}): HeuristicPreFilterResult {
  return {
    passesPreFilter: true,
    exactHit: true,
    heuristicScore: 8,
    heuristicReasons: ['exact_name'],
    ...overrides
  }
}

function okClassification(overrides: Partial<Extract<MessageClassifierResult, { ok: true }>> = {}): MessageClassifierResult {
  return {
    ok: true,
    decision: 'YES',
    type: 'CUSTOMER_REVIEW',
    sentiment: 'POSITIVE',
    urgency: 'LOW',
    confidence: 0.95,
    shortReason: 'Положительный отзыв',
    ...overrides
  }
}

function visibleRouting(overrides: Partial<MessageRoutingResult> = {}): MessageRoutingResult {
  return { isInboxVisible: true, needsManualReview: false, ...overrides }
}

describe('buildExternalMentionId', () => {
  it('is stable and keyed by chatId + messageId, not username', () => {
    expect(buildExternalMentionId('999', 42)).toBe('tg:999:42')
  })
})

describe('buildTelegramMessageUrl', () => {
  it('builds a t.me link when a public username is present', () => {
    expect(buildTelegramMessageUrl('mychannel', 42)).toBe('https://t.me/mychannel/42')
  })

  it('returns null instead of a fabricated URL when there is no username', () => {
    expect(buildTelegramMessageUrl(null, 42)).toBeNull()
  })
})

describe('mapTelegramMessageToMentionParams', () => {
  it('maps a public-channel message plus a successful classification into DedupService.persistMention params', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage(),
      matchedQuery: 'Кофейня Ромашка',
      preFilter: preFilter(),
      classification: okClassification(),
      routing: visibleRouting(),
      companyId: 'c1',
      sourceId: 's1',
      companySourceTargetId: 'cst1'
    })

    expect(params.externalMentionId).toBe('tg:999:42')
    expect(params.url).toBe('https://t.me/mychannel/42')
    expect(params.platform).toBe('TELEGRAM')
    expect(params.type).toBe('SOCIAL_MENTION')
    expect(params.matchedQuery).toBe('Кофейня Ромашка')
    expect(params.relevanceScore).toBe(8)
    expect(params.rawPayload.entityType).toBe('channel')
    expect(params.messageClassification).toBe('CUSTOMER_REVIEW')
    expect(params.messageClassConfidence).toBe(0.95)
    expect(params.messageUrgency).toBe('LOW')
    expect(params.messageClassReason).toBe('Положительный отзыв')
    expect(params.isInboxVisible).toBe(true)
    expect(params.needsManualReview).toBe(false)
    expect(params.classifiedAt).toBeInstanceOf(Date)
  })

  it('never fabricates a URL for a source without a public username', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage({ username: null }),
      matchedQuery: 'Кофейня Ромашка',
      preFilter: preFilter(),
      classification: okClassification(),
      routing: visibleRouting(),
      companyId: 'c1',
      sourceId: 's1'
    })

    expect(params.url).toBeNull()
  })

  it('stores the technical failure reason and nulls out classification fields on ok:false, without losing the Mention', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage(),
      matchedQuery: 'Кофейня Ромашка',
      preFilter: preFilter(),
      classification: { ok: false, errorReason: 'network_error:timeout' },
      routing: { isInboxVisible: true, needsManualReview: true },
      companyId: 'c1',
      sourceId: 's1'
    })

    expect(params.messageClassification).toBeNull()
    expect(params.messageClassConfidence).toBeNull()
    expect(params.messageUrgency).toBeNull()
    expect(params.messageClassReason).toBe('network_error:timeout')
    expect(params.isInboxVisible).toBe(true)
    expect(params.needsManualReview).toBe(true)
    // Content itself is preserved — a technical failure never drops the Mention.
    expect(params.content).toBe(rawMessage().text)
  })

  it('marks a confidently-hidden OWNED_PROMO as isInboxVisible=false via the routing param', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage(),
      matchedQuery: 'Кофейня Ромашка',
      preFilter: preFilter(),
      classification: okClassification({ type: 'OWNED_PROMO', confidence: 0.95 }),
      routing: { isInboxVisible: false, needsManualReview: false },
      companyId: 'c1',
      sourceId: 's1'
    })

    expect(params.messageClassification).toBe('OWNED_PROMO')
    expect(params.isInboxVisible).toBe(false)
  })
})
