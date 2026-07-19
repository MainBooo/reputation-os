import { Api, errors } from 'teleproto'
import bigInt from 'big-integer'
import { TelegramGlobalSearchService } from './telegram-global-search.service'

function makeChannel(
  id: number,
  opts: Partial<{ broadcast: boolean; megagroup: boolean; username: string; title: string; accessHash: number }> = {}
) {
  return new Api.Channel({
    id: bigInt(id),
    title: opts.title ?? `Channel ${id}`,
    broadcast: opts.broadcast ?? false,
    megagroup: opts.megagroup ?? false,
    username: opts.username,
    accessHash: opts.accessHash !== undefined ? bigInt(opts.accessHash) : undefined,
    photo: new Api.ChatPhotoEmpty(),
    date: 1_700_000_000
  })
}

function chatsResponse(chats: Api.TypeChat[]) {
  return new Api.messages.Chats({ chats })
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
  let service: TelegramGlobalSearchService

  beforeEach(() => {
    // Fresh instance per test — resolvedUsernameCache is instance-scoped and must
    // not leak resolved/cached usernames between unrelated test cases.
    service = new TelegramGlobalSearchService()
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

  describe('resolving "min" channels without a username', () => {
    it('does not call GetChannels when the search result already has a full channel with username', async () => {
      const chat = makeChannel(111, { broadcast: true, username: 'mychannel' })
      const message = makeMessage(1, 111, 'text')
      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([message], [chat]))
        .mockResolvedValueOnce(messagesPage([], []))

      await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      const getChannelsCalls = invoke.mock.calls.filter(([req]) => req instanceof Api.channels.GetChannels)
      expect(getChannelsCalls).toHaveLength(0)
    })

    it('resolves username via channels.GetChannels when the chat came back as a "min" constructor', async () => {
      const minChat = makeChannel(222, { broadcast: true, accessHash: 555 }) // no username
      const resolvedChat = makeChannel(222, { broadcast: true, username: 'realusername', accessHash: 555 })
      const message = makeMessage(2, 222, 'text')

      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([message], [minChat]))
        .mockResolvedValueOnce(chatsResponse([resolvedChat]))
        .mockResolvedValueOnce(messagesPage([], []))

      const result = await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      expect(result.messages[0].username).toBe('realusername')
      const getChannelsCall = invoke.mock.calls.find(([req]) => req instanceof Api.channels.GetChannels)
      expect(getChannelsCall).toBeDefined()
      const inputChannels = getChannelsCall![0].id as Api.InputChannel[]
      expect(inputChannels).toHaveLength(1)
      expect(inputChannels[0].channelId.toString()).toBe('222')
    })

    it('resolves a single unresolved channel only once even with multiple messages from it', async () => {
      const minChat = makeChannel(333, { broadcast: true, accessHash: 777 })
      const resolvedChat = makeChannel(333, { broadcast: true, username: 'multi', accessHash: 777 })
      const messages = [makeMessage(1, 333, 'first'), makeMessage(2, 333, 'second')]

      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage(messages, [minChat]))
        .mockResolvedValueOnce(chatsResponse([resolvedChat]))
        .mockResolvedValueOnce(messagesPage([], []))

      const result = await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      expect(result.messages).toHaveLength(2)
      expect(result.messages.every((m) => m.username === 'multi')).toBe(true)
      const getChannelsCalls = invoke.mock.calls.filter(([req]) => req instanceof Api.channels.GetChannels)
      expect(getChannelsCalls).toHaveLength(1)
    })

    it('resolves multiple distinct unresolved channels in a single batch call', async () => {
      const minA = makeChannel(1, { broadcast: true, accessHash: 10 })
      const minB = makeChannel(2, { broadcast: true, accessHash: 20 })
      const resolvedA = makeChannel(1, { broadcast: true, username: 'chan_a', accessHash: 10 })
      const resolvedB = makeChannel(2, { broadcast: true, username: 'chan_b', accessHash: 20 })
      const messages = [makeMessage(1, 1, 'from a'), makeMessage(2, 2, 'from b')]

      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage(messages, [minA, minB]))
        .mockResolvedValueOnce(chatsResponse([resolvedA, resolvedB]))
        .mockResolvedValueOnce(messagesPage([], []))

      const result = await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      const getChannelsCalls = invoke.mock.calls.filter(([req]) => req instanceof Api.channels.GetChannels)
      expect(getChannelsCalls).toHaveLength(1)
      const inputChannels = getChannelsCalls[0][0].id as Api.InputChannel[]
      expect(inputChannels.map((c) => c.channelId.toString()).sort()).toEqual(['1', '2'])
      expect(result.messages.find((m) => m.chatId === '1')?.username).toBe('chan_a')
      expect(result.messages.find((m) => m.chatId === '2')?.username).toBe('chan_b')
    })

    it('leaves username null (never fabricated) when the resolved channel genuinely has no username', async () => {
      const minChat = makeChannel(444, { broadcast: true, accessHash: 888 })
      const stillNoUsername = makeChannel(444, { broadcast: true, accessHash: 888 }) // resolved, still no username
      const message = makeMessage(1, 444, 'text')

      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([message], [minChat]))
        .mockResolvedValueOnce(chatsResponse([stillNoUsername]))
        .mockResolvedValueOnce(messagesPage([], []))

      const result = await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      expect(result.messages[0].username).toBeNull()
    })

    it('does not re-resolve a chatId already cached from an earlier call within the same run', async () => {
      const minChat = makeChannel(555, { broadcast: true, accessHash: 111 })
      const resolvedChat = makeChannel(555, { broadcast: true, username: 'cached_one', accessHash: 111 })

      const firstInvoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([makeMessage(1, 555, 'first query')], [minChat]))
        .mockResolvedValueOnce(chatsResponse([resolvedChat]))
        .mockResolvedValueOnce(messagesPage([], []))

      const firstResult = await service.searchChannels(fakeClient(firstInvoke), { query: 'first query', maxPages: 3, remainingMessageBudget: 100 })
      expect(firstResult.messages[0].username).toBe('cached_one')

      // A second, independent search (as if a different query in the same discovery
      // run) encounters the SAME chat, still returned as "min" by Telegram — the
      // cache from the first call must serve the username without a new GetChannels call.
      const secondInvoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([makeMessage(2, 555, 'second query')], [minChat]))
        .mockResolvedValueOnce(messagesPage([], []))

      const secondResult = await service.searchChannels(fakeClient(secondInvoke), { query: 'second query', maxPages: 3, remainingMessageBudget: 100 })

      expect(secondResult.messages[0].username).toBe('cached_one')
      const getChannelsCallsSecondRun = secondInvoke.mock.calls.filter(([req]) => req instanceof Api.channels.GetChannels)
      expect(getChannelsCallsSecondRun).toHaveLength(0)
    })

    it('does not throw and still returns the page when the GetChannels resolve call fails', async () => {
      process.env.TELEGRAM_SEARCH_RETRY_ATTEMPTS = '1' // no retry backoff delay for this test
      const minChat = makeChannel(666, { broadcast: true, accessHash: 222 })
      const message = makeMessage(1, 666, 'still processed')

      const invoke = jest.fn()
        .mockResolvedValueOnce(messagesPage([message], [minChat])) // page 1, chat unresolved
        .mockRejectedValueOnce(new Error('RPC error resolving channel')) // GetChannels attempt fails
        .mockResolvedValueOnce(messagesPage([], [])) // page 2, ends pagination cleanly

      const result = await service.searchChannels(fakeClient(invoke), { query: 'q', maxPages: 3, remainingMessageBudget: 100 })

      expect(result.messages).toHaveLength(1)
      expect(result.messages[0].username).toBeNull()
      expect(result.stoppedReason).toBe('empty_page')
    })
  })
})
