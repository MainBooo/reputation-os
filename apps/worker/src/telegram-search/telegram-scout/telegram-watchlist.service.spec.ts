import { TelegramWatchlistService } from './telegram-watchlist.service'
import type { TelegramRawMessage } from './telegram-scout.types'

function rawMessage(id: number, text: string): TelegramRawMessage {
  return {
    id,
    chatId: '555',
    username: 'pub',
    title: 'Public Channel',
    entityType: 'channel',
    text,
    date: new Date('2026-07-18T12:00:00Z'),
    views: 10,
    forwards: 0,
    replyCount: 0,
    reactionsCount: 0,
    authorName: null
  }
}

const ALL_MESSAGES = [rawMessage(101, 'msg 101'), rawMessage(102, 'msg 102'), rawMessage(103, 'msg 103')]

function company(id: string) {
  return {
    id,
    workspaceId: 'w1',
    name: `Company ${id}`,
    normalizedName: `company ${id}`,
    website: null,
    normalizedWebsite: null,
    city: null,
    normalizedCity: null,
    industry: null,
    description: null,
    logoUrl: null,
    isActive: true,
    responsePreset: 'FORMAL',
    initialSyncCompletedAt: null,
    lastSyncedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    subscriptionId: null
  } as any
}

describe('TelegramWatchlistService — multi-company cursor isolation (plan §2)', () => {
  let cursors: Record<string, number>
  let persistCalls: Array<{ companyId: string; messageId: number }>
  let failOn: { companyId: string; messageId: number } | null

  let prisma: any
  let channelSearch: any
  let relevance: any
  let dedup: any
  let scoutSource: any
  let service: TelegramWatchlistService

  beforeEach(() => {
    cursors = { 'company-a': 100, 'company-b': 100 }
    persistCalls = []
    failOn = null

    prisma = {
      telegramChannel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'tc1', chatId: '555', username: 'pub' }),
        update: jest.fn().mockResolvedValue(undefined)
      },
      companyTelegramChannel: {
        findMany: jest.fn().mockImplementation(async () => [
          {
            id: 'cta',
            companyId: 'company-a',
            lastMessageId: cursors['company-a'],
            matchedQuery: 'Company a',
            company: { ...company('company-a'), aliases: [] }
          },
          {
            id: 'ctb',
            companyId: 'company-b',
            lastMessageId: cursors['company-b'],
            matchedQuery: 'Company b',
            company: { ...company('company-b'), aliases: [] }
          }
        ]),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => {
          const id = where.id
          const companyId = id === 'cta' ? 'company-a' : 'company-b'
          if (typeof data.lastMessageId === 'number') cursors[companyId] = data.lastMessageId
        })
      }
    }

    channelSearch = {
      searchWithinPeer: jest.fn().mockImplementation(async (_client: any, _target: any, options: any) => {
        const minId = options.minId ?? 0
        const messages = ALL_MESSAGES.filter((m) => m.id > minId).slice(0, options.remainingMessageBudget)
        return { messages, pagesFetched: 1, stoppedReason: messages.length ? 'empty_page' : 'empty_page' }
      })
    }

    relevance = {
      evaluate: jest.fn().mockResolvedValue({ verdict: 'YES', score: 10, reason: 'exact_name', viaLlm: false })
    }

    dedup = {
      persistMention: jest.fn().mockImplementation(async (params: any) => {
        const messageId = Number(params.externalMentionId.split(':')[2])
        if (failOn && failOn.companyId === params.companyId && failOn.messageId === messageId) {
          throw new Error('simulated transient DB error')
        }
        persistCalls.push({ companyId: params.companyId, messageId })
        return { id: `mention-${params.companyId}-${messageId}` }
      })
    }

    scoutSource = {
      ensureBootstrapTarget: jest.fn().mockImplementation(async (companyId: string) => ({
        sourceId: `source-${companyId}`,
        companySourceTargetId: `cst-${companyId}`,
        autoAddToWatchlist: false
      }))
    }

    service = new TelegramWatchlistService(prisma, channelSearch, relevance, dedup, scoutSource)
  })

  it('advances the successful company past a message that fails for another company, without losing or duplicating it', async () => {
    // company-b fails specifically on message 102 during the first cycle.
    failOn = { companyId: 'company-b', messageId: 102 }

    const result1 = await service.processChannel({} as any, 'tc1')

    expect(cursors['company-a']).toBe(103) // fully caught up
    expect(cursors['company-b']).toBe(101) // stopped right before the failure, nothing skipped
    expect(result1.errors).toHaveLength(1)
    expect(result1.errors[0].companyId).toBe('company-b')

    // company-a already has 101/102/103 persisted; company-b only has 101.
    expect(persistCalls.filter((c) => c.companyId === 'company-a')).toHaveLength(3)
    expect(persistCalls.filter((c) => c.companyId === 'company-b')).toHaveLength(1)

    // Second cycle: the transient error is gone — company-b should pick up
    // exactly where it left off (102, 103), and company-a must not be re-processed.
    failOn = null
    const result2 = await service.processChannel({} as any, 'tc1')

    expect(result2.errors).toHaveLength(0)
    expect(cursors['company-a']).toBe(103)
    expect(cursors['company-b']).toBe(103)

    // No duplicate persistMention calls for messages already successfully processed.
    const aCalls = persistCalls.filter((c) => c.companyId === 'company-a')
    const bCalls = persistCalls.filter((c) => c.companyId === 'company-b')
    expect(aCalls).toHaveLength(3) // unchanged — 101/102/103 exactly once each
    expect(new Set(aCalls.map((c) => c.messageId)).size).toBe(3)
    expect(bCalls).toHaveLength(3) // 101 (cycle 1) + 102, 103 (cycle 2)
    expect(new Set(bCalls.map((c) => c.messageId)).size).toBe(3)
  })

  it('reads the physical channel exactly once per cycle regardless of company count', async () => {
    await service.processChannel({} as any, 'tc1')
    expect(channelSearch.searchWithinPeer).toHaveBeenCalledTimes(1)
  })

  it('backfills a brand-new company (lastMessageId=null) without touching an existing cursor company', async () => {
    cursors = { 'company-a': 100, 'company-b': 100 }
    prisma.companyTelegramChannel.findMany.mockResolvedValueOnce([
      {
        id: 'cta',
        companyId: 'company-a',
        lastMessageId: 100,
        matchedQuery: 'Company a',
        company: { ...company('company-a'), aliases: [] }
      },
      {
        id: 'ctc',
        companyId: 'company-c',
        lastMessageId: null,
        matchedQuery: 'Company c',
        company: { ...company('company-c'), aliases: [] }
      }
    ])

    const result = await service.processChannel({} as any, 'tc1')

    expect(result.errors).toHaveLength(0)
    // The new joiner backfill call + the withCursor call = 2 searchWithinPeer calls.
    expect(channelSearch.searchWithinPeer).toHaveBeenCalledTimes(2)
  })
})
