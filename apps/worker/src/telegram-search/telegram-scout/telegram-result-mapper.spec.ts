import { buildExternalMentionId, buildTelegramMessageUrl, mapTelegramMessageToMentionParams } from './telegram-result-mapper'
import type { RelevanceResult, TelegramRawMessage } from './telegram-scout.types'

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

function relevance(overrides: Partial<RelevanceResult> = {}): RelevanceResult {
  return {
    verdict: 'YES',
    score: 0.9,
    reason: 'exact_name',
    matchedEntity: 'Кофейня Ромашка',
    topic: 'отзыв',
    viaLlm: false,
    ...overrides
  }
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
  it('maps a public-channel message into DedupService.persistMention params', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage(),
      matchedQuery: 'Кофейня Ромашка',
      relevance: relevance(),
      companyId: 'c1',
      sourceId: 's1',
      companySourceTargetId: 'cst1'
    })

    expect(params.externalMentionId).toBe('tg:999:42')
    expect(params.url).toBe('https://t.me/mychannel/42')
    expect(params.platform).toBe('TELEGRAM')
    expect(params.type).toBe('SOCIAL_MENTION')
    expect(params.matchedQuery).toBe('Кофейня Ромашка')
    expect(params.relevanceScore).toBe(0.9)
    expect(params.rawPayload.entityType).toBe('channel')
    expect((params.metadata.relevance as any).verdict).toBe('YES')
  })

  it('never fabricates a URL for a source without a public username', () => {
    const params = mapTelegramMessageToMentionParams({
      message: rawMessage({ username: null }),
      matchedQuery: 'Кофейня Ромашка',
      relevance: relevance(),
      companyId: 'c1',
      sourceId: 's1'
    })

    expect(params.url).toBeNull()
  })
})
