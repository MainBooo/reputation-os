import { Api, errors } from 'teleproto'
import bigInt from 'big-integer'
import { TelegramChannelSearchService } from './telegram-channel-search.service'

function makeChannel(id: number, username = 'mychannel') {
  return new Api.Channel({
    id: bigInt(id),
    title: `Channel ${id}`,
    broadcast: true,
    username,
    photo: new Api.ChatPhotoEmpty(),
    date: 1_700_000_000
  })
}

function makeMessage(id: number, chatId: number, text: string) {
  return new Api.Message({
    id,
    peerId: new Api.PeerChannel({ channelId: bigInt(chatId) }),
    date: 1_700_000_000,
    message: text,
    out: false
  })
}

function messagesPage(messages: Api.Message[], chats: Api.TypeChat[]) {
  return new Api.messages.MessagesSlice({ count: messages.length, messages, chats, users: [], topics: [] })
}

function fakeClient(invokeImpl: jest.Mock) {
  return { invoke: invokeImpl } as any
}

describe('TelegramChannelSearchService', () => {
  const service = new TelegramChannelSearchService()

  beforeEach(() => {
    process.env.TELEGRAM_SEARCH_DELAY_MS = '0'
    process.env.TELEGRAM_SEARCH_RETRY_ATTEMPTS = '2'
  })

  it('fetches and maps messages for a public peer by username', async () => {
    const chat = makeChannel(111, 'mychannel')
    const invoke = jest.fn()
      .mockResolvedValueOnce(messagesPage([makeMessage(50, 111, 'привет мир')], [chat]))
      .mockResolvedValueOnce(messagesPage([], []))

    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '111', username: 'mychannel' },
      { minId: 10, maxPages: 3, remainingMessageBudget: 100 }
    )

    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toMatchObject({ id: 50, chatId: '111', username: 'mychannel', text: 'привет мир' })
    expect(result.stoppedReason).toBe('empty_page')

    const call = invoke.mock.calls[0][0]
    expect(call.peer).toBe('mychannel')
    expect(call.minId).toBe(10)
  })

  it('stops as exhausted once it walks back to the minId cursor', async () => {
    const chat = makeChannel(1)
    const invoke = jest.fn().mockResolvedValueOnce(
      messagesPage([makeMessage(11, 1, 'a'), makeMessage(10, 1, 'boundary')], [chat])
    )

    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '1', username: 'c' },
      { minId: 10, maxPages: 5, remainingMessageBudget: 100 }
    )

    expect(invoke).toHaveBeenCalledTimes(1)
    expect(result.stoppedReason).toBe('exhausted')
    expect(result.messages).toHaveLength(2)
  })

  it('stops at the remaining message budget', async () => {
    const chat = makeChannel(1)
    const invoke = jest.fn().mockResolvedValue(
      messagesPage([makeMessage(3, 1, 'a'), makeMessage(2, 1, 'b'), makeMessage(1, 1, 'c')], [chat])
    )

    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '1', username: 'c' },
      { minId: 0, maxPages: 5, remainingMessageBudget: 2 }
    )

    expect(result.messages).toHaveLength(2)
    expect(result.stoppedReason).toBe('max_messages')
  })

  it('stops on FloodWaitError without throwing', async () => {
    const invoke = jest.fn().mockRejectedValue(new errors.FloodWaitError({ request: {}, capture: 30 }))

    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '1', username: 'c' },
      { minId: 0, maxPages: 3, remainingMessageBudget: 100 }
    )

    expect(result.stoppedReason).toBe('flood_wait')
    expect(result.floodWaitSeconds).toBe(30)
  })

  it('returns immediately with max_messages when the budget is already zero', async () => {
    const invoke = jest.fn()
    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '1', username: 'c' },
      { minId: 0, maxPages: 3, remainingMessageBudget: 0 }
    )

    expect(invoke).not.toHaveBeenCalled()
    expect(result.stoppedReason).toBe('max_messages')
  })

  it('caps pagination at maxPages when the peer keeps returning fresh pages', async () => {
    const chat = makeChannel(1)
    const invoke = jest.fn()
      .mockResolvedValueOnce(messagesPage([makeMessage(20, 1, 'a')], [chat]))
      .mockResolvedValueOnce(messagesPage([makeMessage(19, 1, 'b')], [chat]))

    const result = await service.searchWithinPeer(
      fakeClient(invoke),
      { chatId: '1', username: 'c' },
      { minId: 0, maxPages: 2, remainingMessageBudget: 100 }
    )

    expect(invoke).toHaveBeenCalledTimes(2)
    expect(result.stoppedReason).toBe('max_pages')
  })
})
