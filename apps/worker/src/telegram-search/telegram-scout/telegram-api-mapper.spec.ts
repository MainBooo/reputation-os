import { Api } from 'teleproto'
import bigInt from 'big-integer'
import {
  classifyEntityType,
  mapApiMessage,
  mapApiMessages,
  mapChatToCandidate,
  normalizeMessagesResponse
} from './telegram-api-mapper'

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

function makeChat(id: number, title = 'Basic Group') {
  return new Api.Chat({
    id: bigInt(id),
    title,
    photo: new Api.ChatPhotoEmpty(),
    participantsCount: 5,
    date: 1_700_000_000,
    version: 1
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

describe('classifyEntityType', () => {
  it('classifies a broadcast channel as "channel"', () => {
    expect(classifyEntityType(makeChannel(1, { broadcast: true }))).toBe('channel')
  })

  it('classifies a megagroup channel as "supergroup"', () => {
    expect(classifyEntityType(makeChannel(1, { megagroup: true }))).toBe('supergroup')
  })

  it('classifies a plain basic group (Api.Chat) as "group"', () => {
    expect(classifyEntityType(makeChat(1))).toBe('group')
  })

  it('returns null for a channel that is neither broadcast nor megagroup', () => {
    expect(classifyEntityType(makeChannel(1))).toBeNull()
  })

  it('returns null for forbidden chats', () => {
    const forbidden = new Api.ChannelForbidden({ id: bigInt(1), accessHash: bigInt(0), title: 'Gone', broadcast: true })
    expect(classifyEntityType(forbidden as any)).toBeNull()
  })
})

describe('mapChatToCandidate', () => {
  it('returns null username for a basic group (never public by username)', () => {
    const candidate = mapChatToCandidate(makeChat(5, 'Local Group'))
    expect(candidate).toEqual({ chatId: '5', username: null, title: 'Local Group', entityType: 'group' })
  })

  it('preserves a channel with no public username as username=null (never fabricated)', () => {
    const candidate = mapChatToCandidate(makeChannel(6, { broadcast: true }))
    expect(candidate?.username).toBeNull()
  })

  it('returns null for a plain user (contacts.Search can surface users too)', () => {
    const user = new Api.User({ id: bigInt(9), self: false, contact: false, mutualContact: false, deleted: false, bot: false })
    expect(mapChatToCandidate(user as any)).toBeNull()
  })
})

describe('mapApiMessage / mapApiMessages', () => {
  it('maps a message from a channel with no username, keeping username null', () => {
    const chat = makeChannel(1, { broadcast: true }) // no username
    const message = makeMessage(10, 1, 'hello')

    const mapped = mapApiMessages([message], [chat])
    expect(mapped).toHaveLength(1)
    expect(mapped[0].username).toBeNull()
    expect(mapped[0].chatId).toBe('1')
  })

  it('maps a supergroup message with entityType "supergroup"', () => {
    const chat = makeChannel(2, { megagroup: true, username: 'mygroup' })
    const message = makeMessage(11, 2, 'hi group')

    const mapped = mapApiMessages([message], [chat])
    expect(mapped[0].entityType).toBe('supergroup')
    expect(mapped[0].username).toBe('mygroup')
  })

  it('skips a message whose chat is not in the resolved chats list', () => {
    const message = makeMessage(12, 999, 'orphan')
    expect(mapApiMessage(message, new Map())).toBeNull()
  })

  it('skips empty/service messages (no .message text)', () => {
    const chat = makeChannel(1, { broadcast: true })
    const emptyMsg = new Api.MessageEmpty({ id: 1 })
    expect(mapApiMessages([emptyMsg], [chat])).toHaveLength(0)
  })
})

describe('normalizeMessagesResponse', () => {
  it('treats MessagesNotModified as an empty page', () => {
    const result = normalizeMessagesResponse(new Api.messages.MessagesNotModified({ count: 0 }))
    expect(result).toEqual({ messages: [], chats: [], nextRate: null })
  })

  it('extracts nextRate from MessagesSlice', () => {
    const result = normalizeMessagesResponse(
      new Api.messages.MessagesSlice({ count: 1, messages: [], chats: [], users: [], topics: [], nextRate: 42 })
    )
    expect(result.nextRate).toBe(42)
  })

  it('returns nextRate=null for plain Messages (no pagination cursor)', () => {
    const result = normalizeMessagesResponse(new Api.messages.Messages({ messages: [], chats: [], users: [], topics: [] }))
    expect(result.nextRate).toBeNull()
  })
})
