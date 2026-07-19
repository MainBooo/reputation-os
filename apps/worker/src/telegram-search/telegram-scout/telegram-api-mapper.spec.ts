import { Api } from 'teleproto'
import bigInt from 'big-integer'
import {
  classifyEntityType,
  extractPrimaryUsername,
  findChannelsNeedingUsernameResolve,
  mapApiMessage,
  mapApiMessages,
  mapChatToCandidate,
  mapResolvedChannelsToUsernameOverrides,
  normalizeMessagesResponse
} from './telegram-api-mapper'

function makeChannel(
  id: number,
  opts: Partial<{
    broadcast: boolean
    megagroup: boolean
    username: string
    title: string
    accessHash: number
    usernames: Array<{ username: string; active: boolean }>
  }> = {}
) {
  return new Api.Channel({
    id: bigInt(id),
    title: opts.title ?? `Channel ${id}`,
    broadcast: opts.broadcast ?? false,
    megagroup: opts.megagroup ?? false,
    username: opts.username,
    usernames: opts.usernames?.map((u) => new Api.Username({ username: u.username, active: u.active })),
    accessHash: opts.accessHash !== undefined ? bigInt(opts.accessHash) : undefined,
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

  it('uses a usernameOverrides entry instead of the (missing) chat username', () => {
    const chat = makeChannel(1, { broadcast: true, accessHash: 999 }) // no username on the chat itself
    const message = makeMessage(10, 1, 'hello')
    const overrides = new Map([['1', 'resolved_username']])

    const mapped = mapApiMessages([message], [chat], overrides)
    expect(mapped[0].username).toBe('resolved_username')
  })

  it('falls back to the chat username when no override is present for that chatId', () => {
    const chat = makeChannel(1, { broadcast: true, username: 'original' })
    const message = makeMessage(10, 1, 'hello')
    const overrides = new Map([['999', 'someone_else']])

    const mapped = mapApiMessages([message], [chat], overrides)
    expect(mapped[0].username).toBe('original')
  })
})

describe('findChannelsNeedingUsernameResolve', () => {
  it('returns channels with no username but a valid accessHash', () => {
    const chat = makeChannel(1, { broadcast: true, accessHash: 42 })
    expect(findChannelsNeedingUsernameResolve([chat])).toHaveLength(1)
  })

  it('excludes channels that already have a username', () => {
    const chat = makeChannel(1, { broadcast: true, username: 'already', accessHash: 42 })
    expect(findChannelsNeedingUsernameResolve([chat])).toHaveLength(0)
  })

  it('excludes channels with no accessHash (nothing to build an InputChannel from)', () => {
    const chat = makeChannel(1, { broadcast: true })
    expect(findChannelsNeedingUsernameResolve([chat])).toHaveLength(0)
  })

  it('excludes non-Channel chats (e.g. plain Api.Chat groups)', () => {
    const chat = makeChat(1)
    expect(findChannelsNeedingUsernameResolve([chat])).toHaveLength(0)
  })

  it('de-duplicates the same chatId appearing more than once', () => {
    const chat = makeChannel(1, { broadcast: true, accessHash: 42 })
    expect(findChannelsNeedingUsernameResolve([chat, chat])).toHaveLength(1)
  })

  it('returns multiple distinct unresolved channels', () => {
    const chatA = makeChannel(1, { broadcast: true, accessHash: 42 })
    const chatB = makeChannel(2, { broadcast: true, accessHash: 43 })
    expect(findChannelsNeedingUsernameResolve([chatA, chatB]).map((c) => c.id.toString())).toEqual(['1', '2'])
  })
})

describe('mapResolvedChannelsToUsernameOverrides', () => {
  it('maps resolved channels that now have a username', () => {
    const chat = makeChannel(1, { broadcast: true, username: 'resolved_now' })
    const overrides = mapResolvedChannelsToUsernameOverrides([chat])
    expect(overrides.get('1')).toBe('resolved_now')
  })

  it('omits a channel that was resolved but genuinely still has no username', () => {
    const chat = makeChannel(1, { broadcast: true })
    const overrides = mapResolvedChannelsToUsernameOverrides([chat])
    expect(overrides.has('1')).toBe(false)
  })

  it('falls back to the active entry in usernames[] when the singular username field is empty (real "Mash" channel case)', () => {
    // Confirmed live via channels.GetChannels for chatId 1117628569: username=null,
    // usernames=[{mash, active:true}, {breakingmash, active:true}] — modern
    // "collectible usernames" channels can leave the legacy field empty.
    const chat = makeChannel(1117628569, {
      broadcast: true,
      usernames: [
        { username: 'mash', active: true },
        { username: 'breakingmash', active: true }
      ]
    })
    const overrides = mapResolvedChannelsToUsernameOverrides([chat])
    expect(overrides.get('1117628569')).toBe('mash')
  })
})

describe('extractPrimaryUsername', () => {
  it('returns the singular username when present', () => {
    const chat = makeChannel(1, { broadcast: true, username: 'direct' })
    expect(extractPrimaryUsername(chat)).toBe('direct')
  })

  it('prefers the singular username over usernames[] when both are present', () => {
    const chat = makeChannel(1, { broadcast: true, username: 'direct', usernames: [{ username: 'alt', active: true }] })
    expect(extractPrimaryUsername(chat)).toBe('direct')
  })

  it('falls back to the first active entry in usernames[] when the singular field is empty', () => {
    const chat = makeChannel(1, {
      broadcast: true,
      usernames: [
        { username: 'inactive_one', active: false },
        { username: 'active_one', active: true }
      ]
    })
    expect(extractPrimaryUsername(chat)).toBe('active_one')
  })

  it('returns null when neither the singular field nor any active usernames[] entry exists', () => {
    const chat = makeChannel(1, { broadcast: true, usernames: [{ username: 'inactive_only', active: false }] })
    expect(extractPrimaryUsername(chat)).toBeNull()
  })

  it('returns null when there is no username at all', () => {
    const chat = makeChannel(1, { broadcast: true })
    expect(extractPrimaryUsername(chat)).toBeNull()
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
