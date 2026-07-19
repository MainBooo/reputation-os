import { TelegramScoutService } from './telegram-scout.service'
import type { TelegramRawMessage } from './telegram-scout.types'

function rawMessage(id: number, chatId: string, text: string, username: string | null = 'chan'): TelegramRawMessage {
  return {
    id,
    chatId,
    username,
    title: 'Channel Title',
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

function company() {
  return {
    id: 'c1',
    workspaceId: 'w1',
    name: 'Кофейня Ромашка',
    normalizedName: 'кофейня ромашка',
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
    subscriptionId: null,
    aliases: [{ id: 'a1', companyId: 'c1', value: 'Ромашка', normalizedValue: 'ромашка', priority: 1, isPrimary: true, isExcluded: false, createdAt: new Date(), updatedAt: new Date() }]
  } as any
}

function emptyResult() {
  return { messages: [], pagesFetched: 1, stoppedReason: 'empty_page' as const }
}

const REJECT_PRE_FILTER = { passesPreFilter: false, hardRejectReason: 'no_signal', exactHit: false, heuristicScore: 0, heuristicReasons: [] }
const PASS_PRE_FILTER = { passesPreFilter: true, exactHit: true, heuristicScore: 10, heuristicReasons: ['exact_name'] }

const HIT_CLASSIFICATION = {
  ok: true,
  decision: 'YES',
  type: 'CUSTOMER_REVIEW',
  sentiment: 'POSITIVE',
  urgency: 'LOW',
  confidence: 0.95,
  shortReason: 'Отзыв клиента'
}

describe('TelegramScoutService.runDiscovery', () => {
  let prisma: any
  let queryBuilder: any
  let globalSearch: any
  let channelSearch: any
  let relevance: any
  let messageClassifier: any
  let dedup: any
  let scoutSource: any
  let service: TelegramScoutService
  let telegramChannels: Map<string, any>
  let companyLinks: Map<string, any>

  beforeEach(() => {
    telegramChannels = new Map()
    companyLinks = new Map()

    prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(company()) },
      telegramChannel: {
        upsert: jest.fn().mockImplementation(async ({ where, create }: any) => {
          const existing = telegramChannels.get(where.chatId)
          if (existing) return existing
          const created = { id: `tc-${where.chatId}`, ...create }
          telegramChannels.set(where.chatId, created)
          return created
        })
      },
      companyTelegramChannel: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          const key = `${where.companyId_telegramChannelId.companyId}:${where.companyId_telegramChannelId.telegramChannelId}`
          return companyLinks.get(key) ?? null
        }),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const key = `${data.companyId}:${data.telegramChannelId}`
          const row = { id: `ctc-${key}`, ...data }
          companyLinks.set(key, row)
          return row
        })
      }
    }

    queryBuilder = { build: jest.fn().mockReturnValue([{ text: 'Ромашка', class: 'strong' }]) }

    globalSearch = {
      searchChannels: jest.fn().mockResolvedValue(emptyResult()),
      searchGroups: jest.fn().mockResolvedValue(emptyResult()),
      searchHashtagPosts: jest.fn().mockResolvedValue(emptyResult()),
      searchEntities: jest.fn().mockResolvedValue([])
    }

    channelSearch = { searchWithinPeer: jest.fn().mockResolvedValue(emptyResult()) }

    relevance = { preFilter: jest.fn().mockReturnValue(REJECT_PRE_FILTER) }

    messageClassifier = { classify: jest.fn().mockResolvedValue(HIT_CLASSIFICATION) }

    dedup = { persistMention: jest.fn().mockResolvedValue({ id: 'm1' }) }

    scoutSource = {
      ensureBootstrapTarget: jest.fn().mockResolvedValue({ sourceId: 's1', companySourceTargetId: 'cst1', autoAddToWatchlist: false })
    }

    service = new TelegramScoutService(prisma, queryBuilder, globalSearch, channelSearch, relevance, messageClassifier, dedup, scoutSource)
  })

  it('runs a clean pass with no results and reports exhausted', async () => {
    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.queriesExecuted).toEqual([{ text: 'Ромашка', class: 'strong' }])
    expect(stats.mentionsConfirmed).toBe(0)
    expect(stats.stoppedReason).toBe('exhausted')
  })

  it('rejects a message that fails the pre-filter without calling the classifier or persisting anything', async () => {
    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'Сегодня хорошая погода')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })

    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.mentionsRejected).toBe(1)
    expect(stats.mentionsConfirmed).toBe(0)
    expect(messageClassifier.classify).not.toHaveBeenCalled()
    expect(dedup.persistMention).not.toHaveBeenCalled()
  })

  it('persists every message that passes the pre-filter, including IRRELEVANT/technical-failure ones (audit principle)', async () => {
    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'Кофейня Ромашка это круто')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)
    messageClassifier.classify.mockResolvedValueOnce({
      ok: true,
      decision: 'NO',
      type: 'IRRELEVANT',
      sentiment: 'NEUTRAL',
      urgency: 'LOW',
      confidence: 0.95,
      shortReason: 'Не относится к компании'
    })

    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.mentionsConfirmed).toBe(1)
    expect(dedup.persistMention).toHaveBeenCalledTimes(1)
    expect(stats.mentionsHidden).toBe(1)
  })

  it('does not lose a Mention on a technical classifier failure — persists with needsManualReview', async () => {
    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'Кофейня Ромашка это круто')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)
    messageClassifier.classify.mockResolvedValueOnce({ ok: false, errorReason: 'network_error:timeout' })

    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.mentionsConfirmed).toBe(1)
    expect(stats.mentionsNeedReview).toBe(1)
    const persistedParams = dedup.persistMention.mock.calls[0][0]
    expect(persistedParams.needsManualReview).toBe(true)
    expect(persistedParams.isInboxVisible).toBe(true)
  })

  it('persists a YES mention and creates a disabled watchlist candidate by default', async () => {
    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'Кофейня Ромашка это круто')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)

    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.mentionsConfirmed).toBe(1)
    expect(dedup.persistMention).toHaveBeenCalledTimes(1)
    expect(stats.newChannelsFound).toBe(1)

    const link = [...companyLinks.values()][0]
    expect(link.enabled).toBe(false)
  })

  it('does not count a confident IRRELEVANT/SPAM classification toward channel discovery yesCount', async () => {
    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'msg1')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)
    messageClassifier.classify.mockResolvedValueOnce({
      ok: true,
      decision: 'NO',
      type: 'SPAM',
      sentiment: 'NEUTRAL',
      urgency: 'LOW',
      confidence: 0.95,
      shortReason: 'Спам'
    })

    const stats = await service.runDiscovery({} as any, 'c1')

    expect(stats.mentionsConfirmed).toBe(1)
    expect(stats.newChannelsFound).toBe(0)
    expect(companyLinks.size).toBe(0)
  })

  it('auto-enables a candidate only when autoAddToWatchlist is set and at least 2 YES mentions were found', async () => {
    scoutSource.ensureBootstrapTarget.mockResolvedValue({ sourceId: 's1', companySourceTargetId: 'cst1', autoAddToWatchlist: true })

    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'msg1'), rawMessage(2, 'chat1', 'msg2')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValue(PASS_PRE_FILTER)

    await service.runDiscovery({} as any, 'c1')

    const link = [...companyLinks.values()][0]
    expect(link.enabled).toBe(true)
  })

  it('does not auto-enable when only a single YES mention was found even with autoAddToWatchlist on', async () => {
    scoutSource.ensureBootstrapTarget.mockResolvedValue({ sourceId: 's1', companySourceTargetId: 'cst1', autoAddToWatchlist: true })

    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'msg1')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)

    await service.runDiscovery({} as any, 'c1')

    const link = [...companyLinks.values()][0]
    expect(link.enabled).toBe(false)
  })

  it('never fabricates a second query beyond what the query builder returned, and stops on max_runtime', async () => {
    queryBuilder.build.mockReturnValue([
      { text: 'q1', class: 'strong' },
      { text: 'q2', class: 'medium' }
    ])

    let call = 0
    globalSearch.searchChannels.mockImplementation(async () => {
      call += 1
      if (call === 1) {
        // Simulate the first query eating the whole runtime budget.
        await new Promise((r) => setTimeout(r, 5))
      }
      return emptyResult()
    })

    // Force an artificially tiny runtime budget via env override read inside loadTelegramScoutBudgets.
    process.env.TELEGRAM_SCOUT_MAX_RUNTIME_MS = '1'
    const stats = await service.runDiscovery({} as any, 'c1')
    delete process.env.TELEGRAM_SCOUT_MAX_RUNTIME_MS

    expect(stats.stoppedReason).toBe('max_runtime')
    expect(stats.queriesExecuted).toHaveLength(1)
  })

  it('stops promoting new sources once maxNewSourcesPerRun is reached', async () => {
    process.env.TELEGRAM_SCOUT_MAX_NEW_SOURCES_PER_RUN = '1'

    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chatA', 'msgA'), rawMessage(2, 'chatB', 'msgB')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValue(PASS_PRE_FILTER)

    const stats = await service.runDiscovery({} as any, 'c1')
    delete process.env.TELEGRAM_SCOUT_MAX_NEW_SOURCES_PER_RUN

    expect(stats.newChannelsFound).toBe(1)
    expect(companyLinks.size).toBe(1)
  })

  it('does not create a duplicate CompanyTelegramChannel when a candidate is already linked', async () => {
    telegramChannels.set('chat1', { id: 'tc-chat1', chatId: 'chat1', username: 'chan', title: 'Channel Title', entityType: 'channel' })
    companyLinks.set('c1:tc-chat1', { id: 'existing-link', companyId: 'c1', telegramChannelId: 'tc-chat1', enabled: true })

    globalSearch.searchChannels.mockResolvedValueOnce({
      messages: [rawMessage(1, 'chat1', 'msg1')],
      pagesFetched: 1,
      stoppedReason: 'empty_page'
    })
    relevance.preFilter.mockReturnValueOnce(PASS_PRE_FILTER)

    await service.runDiscovery({} as any, 'c1')

    expect(companyLinks.size).toBe(1)
    expect(prisma.companyTelegramChannel.create).not.toHaveBeenCalled()
  })
})
