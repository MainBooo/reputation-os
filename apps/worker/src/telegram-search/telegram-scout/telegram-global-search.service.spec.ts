import { Api, errors } from 'teleproto'
import bigInt from 'big-integer'
import { TelegramGlobalSearchService } from './telegram-global-search.service'

function makeChannel(id: number, opts: Partial<{ broadcast: boolean; megagroup: boolean; username: string; title: string }> = {}) {
  return new Api.Channel({
    id: bigInt(id),
    title: opts.title ?? `Channel ${id}`,
    broadcast: opts.broadcast ?? false,
    megagroup: opts.megagroup ?? false,
    username: opts.username,
    photo: new Api.ChatPhotoEmpty(),
    date: 1_700_000_000
  })
}

function makeMessage(id: number, chatId: number, text: string, date = 1_700_000_000) {
  return new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(chatId) }),
    date,
    message: text,
    out: false
  })
}

function messagesPage(messages: Api.Message[], chats: Api.TypeChat[], nextRate: number | null = null) {
  return new Api.messages.MessagesSlice({ count: messages.length, messages, chats, users: [], topics: [], nextRate: nextRate ?? undefined })
}

function fakeClient(invokeImpl: jest.Mock) {
  return { invoke: invokeImpl } as any
}

describe('TelegramGlobalSearchService', () => {
  const service = new TelegramGlobalSearchService()

  beforeEach(() => {
    process.env.TELEGRAM_SEARCH_DELAY_MS = '0'
    process.env.TELEGRAM_SEARCH_RETRY_ATTEMPTS = '2'
    delete process.env.TELEGRAM_SCOUT_ENABLE_HASHTAG_POST_SEARCH
  })

  it('maps a single page of channel results into TelegramRawMessage[]', async () => {
    const chat = makeChannel(111, { broadcast: true, username: 'mychannel' })
    const message = makeMessage(1, 111, 'Кофейня Ромашка открылась')
    const invoke = jest.fn()
      .mockResolvedValueOnce(messagesPage([message], [chat]))
      .mockResolvedValueOnce(messagesPage([], []))

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'Ромашка',
      maxPages: 3,
      remainingMessageBudget: 100
    })

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toMatchObject({
      id: 1,
      chatId: '111',
      username: 'mychannel',
      entityType: 'channel',
      text: 'Кофейня Ромашка открылась'
    })
    expect(result.stoppedReason).toBe('empty_page')

    const call = invoke.mock.calls[0][0]
    expect(call.broadcastsOnly).toBe(true)
  })

  it('passes groupsOnly for searchGroups', async () => {
    const invoke = jest.fn().mockResolvedValue(messagesPage([], []))
    await service.searchGroups(fakeClient(invoke), { query: 'q', maxPages: 1, remainingMessageBudget: 10 })

    const call = invoke.mock.calls[0][0]
    expect(call.groupsOnly).toBe(true)
  })

  it('paginates across multiple pages until maxPages is exhausted', async () => {
    const chat = makeChannel(1, { broadcast: true, username: 'c1' })
    const invoke = jest.fn()
      .mockResolvedValueOnce(messagesPage([makeMessage(10, 1, 'page1')], [chat], 5))
      .mockResolvedValueOnce(messagesPage([makeMessage(9, 1, 'page2')], [chat], 6))

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 2,
      remainingMessageBudget: 100
    })

    expect(invoke).toHaveBeenCalledTimes(2)
    expect(result.messages).toHaveLength(2)
    expect(result.stoppedReason).toBe('max_pages')
  })

  it('stops at the remaining message budget mid-page', async () => {
    const chat = makeChannel(1, { broadcast: true, username: 'c1' })
    const invoke = jest.fn().mockResolvedValue(
      messagesPage([makeMessage(1, 1, 'a'), makeMessage(2, 1, 'b'), makeMessage(3, 1, 'c')], [chat])
    )

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 5,
      remainingMessageBudget: 2
    })

    expect(result.messages).toHaveLength(2)
    expect(result.stoppedReason).toBe('max_messages')
  })

  it('returns immediately with max_messages when the budget is already zero', async () => {
    const invoke = jest.fn()
    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 5,
      remainingMessageBudget: 0
    })

    expect(invoke).not.toHaveBeenCalled()
    expect(result.stoppedReason).toBe('max_messages')
  })

  it('stops on FloodWaitError and reports floodWaitSeconds without throwing', async () => {
    const invoke = jest.fn().mockRejectedValue(new errors.FloodWaitError({ request: {}, capture: 42 }))

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 3,
      remainingMessageBudget: 100
    })

    expect(result.stoppedReason).toBe('flood_wait')
    expect(result.floodWaitSeconds).toBe(42)
  })

  it('treats messages.MessagesNotModified as an empty page', async () => {
    const invoke = jest.fn().mockResolvedValue(new Api.messages.MessagesNotModified({ count: 0 }))

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 3,
      remainingMessageBudget: 100
    })

    expect(result.messages).toHaveLength(0)
    expect(result.stoppedReason).toBe('empty_page')
  })

  it('retries a transient (non-flood) error before succeeding', async () => {
    const chat = makeChannel(1, { broadcast: true, username: 'c1' })
    const invoke = jest.fn()
      .mockRejectedValueOnce(new Error('transient network error'))
      .mockResolvedValueOnce(messagesPage([makeMessage(1, 1, 'ok')], [chat]))

    const result = await service.searchChannels(fakeClient(invoke), {
      query: 'q',
      maxPages: 1,
      remainingMessageBudget: 100
    })

    expect(invoke).toHaveBeenCalledTimes(2)
    expect(result.messages).toHaveLength(1)
  })

  describe('searchHashtagPosts', () => {
    it('does not call the API when disabled (default)', async () => {
      const invoke = jest.fn()
      const result = await service.searchHashtagPosts(fakeClient(invoke), {
        query: '#coffee',
        maxPages: 1,
        remainingMessageBudget: 10
      })

      expect(invoke).not.toHaveBeenCalled()
      expect(result.messages).toHaveLength(0)
    })

    it('calls channels.searchPosts hashtag mode when explicitly enabled', async () => {
      process.env.TELEGRAM_SCOUT_ENABLE_HASHTAG_POST_SEARCH = 'true'
      const invoke = jest.fn().mockResolvedValue(messagesPage([], []))

      await service.searchHashtagPosts(fakeClient(invoke), {
        query: '#coffee',
        maxPages: 1,
        remainingMessageBudget: 10
      })

      expect(invoke).toHaveBeenCalledTimes(1)
      const call = invoke.mock.calls[0][0]
      expect(call.hashtag).toBe('coffee')
      expect(call.query).toBeUndefined()
    })
  })

  describe('searchEntities', () => {
    it('filters contacts.Search results down to channels/groups only', async () => {
      const channel = makeChannel(1, { broadcast: true, username: 'c1' })
      const user = new Api.User({ id: bigInt(55), self: false, contact: false, mutualContact: false, deleted: false, bot: false })
      const invoke = jest.fn().mockResolvedValue(
        new Api.contacts.Found({ myResults: [], results: [], chats: [channel, user as any], users: [] })
      )

      const result = await service.searchEntities(fakeClient(invoke), 'Ромашка', 5)

      expect(result).toEqual([{ chatId: '1', username: 'c1', title: 'Channel 1', entityType: 'channel' }])
    })

    it('returns an empty array instead of throwing on network failure', async () => {
      const invoke = jest.fn().mockRejectedValue(new Error('network down'))
      const result = await service.searchEntities(fakeClient(invoke), 'Ромашка', 5)
      expect(result).toEqual([])
    })
  })
})
