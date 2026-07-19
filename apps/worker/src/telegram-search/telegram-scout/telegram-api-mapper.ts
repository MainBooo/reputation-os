import { Api } from 'teleproto'
import type { TelegramEntityType, TelegramRawMessage } from './telegram-scout.types'

/** Only public channels/supergroups/groups are in scope for Scout — forbidden
 *  placeholders and plain users (contacts.Search can return users too) are skipped. */
export function classifyEntityType(chat: Api.TypeChat): TelegramEntityType | null {
  if (chat instanceof Api.Channel) {
    if (chat.broadcast) return 'channel'
    if (chat.megagroup) return 'supergroup'
    return null
  }

  if (chat instanceof Api.Chat) return 'group'

  return null
}

export function buildChatIndex(chats: Api.TypeChat[]): Map<string, Api.TypeChat> {
  const index = new Map<string, Api.TypeChat>()

  for (const chat of chats) {
    if (chat instanceof Api.Channel || chat instanceof Api.Chat) {
      index.set(chat.id.toString(), chat)
    }
  }

  return index
}

function peerChatId(peer: Api.TypePeer): string | null {
  if (peer instanceof Api.PeerChannel) return peer.channelId.toString()
  if (peer instanceof Api.PeerChat) return peer.chatId.toString()
  return null
}

/** Modern Telegram channels can carry multiple usernames (the "collectible
 *  usernames" feature) via `usernames[]`, with the legacy singular `username`
 *  field left empty even though the channel has one or more active usernames —
 *  confirmed live for the "Mash" channel (username: null, usernames: [{mash,
 *  active:true}, {breakingmash, active:true}]). Checks the singular field
 *  first (unchanged behavior for every channel that already has one), then
 *  falls back to the first active entry in `usernames[]`. Never fabricates —
 *  returns null when neither is present. */
export function extractPrimaryUsername(chat: Api.Channel): string | null {
  if (chat.username) return chat.username

  const active = chat.usernames?.find((u) => u.active)
  return active?.username ?? null
}

/** Raw teleproto Api.Message + its resolved chat → the normalized shape the rest
 *  of Scout works with. Returns null for message types/chats out of scope
 *  (service messages, empty messages, non-channel/group chats, forbidden chats).
 *  `usernameOverrides` (chatId -> username) lets callers supply a username
 *  resolved separately (e.g. via channels.GetChannels) for channels that came
 *  back as a "min" constructor from search without one — falls back to the
 *  chat object's own username when no override is present. */
export function mapApiMessage(
  message: Api.TypeMessage,
  chatIndex: Map<string, Api.TypeChat>,
  usernameOverrides?: Map<string, string>
): TelegramRawMessage | null {
  if (!(message instanceof Api.Message)) return null
  if (!message.message) return null

  const chatId = peerChatId(message.peerId)
  if (!chatId) return null

  const chat = chatIndex.get(chatId)
  if (!chat) return null

  const entityType = classifyEntityType(chat)
  if (!entityType) return null

  const username = usernameOverrides?.get(chatId) ?? (chat instanceof Api.Channel ? extractPrimaryUsername(chat) : null)
  const title = 'title' in chat ? chat.title ?? null : null

  return {
    id: message.id,
    chatId,
    username,
    title,
    entityType,
    text: message.message,
    date: new Date(message.date * 1000),
    views: message.views ?? null,
    forwards: message.forwards ?? null,
    replyCount: message.replies?.replies ?? null,
    reactionsCount: message.reactions?.results?.reduce((sum, r) => sum + (r.count ?? 0), 0) ?? null,
    authorName: message.postAuthor ?? null
  }
}

/** messages.Messages/MessagesSlice/ChannelMessages all carry `.messages`/`.chats`;
 *  MessagesNotModified carries neither (server-side "nothing changed" reply) — the
 *  three pagination loops treat that identically to an empty page by normalizing here. */
export function normalizeMessagesResponse(response: Api.messages.TypeMessages): {
  messages: Api.TypeMessage[]
  chats: Api.TypeChat[]
  nextRate: number | null
} {
  if (response instanceof Api.messages.MessagesNotModified) {
    return { messages: [], chats: [], nextRate: null }
  }

  return {
    messages: response.messages,
    chats: response.chats,
    nextRate: response instanceof Api.messages.MessagesSlice ? response.nextRate ?? null : null
  }
}

export function mapApiMessages(
  messages: Api.TypeMessage[],
  chats: Api.TypeChat[],
  usernameOverrides?: Map<string, string>
): TelegramRawMessage[] {
  const chatIndex = buildChatIndex(chats)
  const result: TelegramRawMessage[] = []

  for (const message of messages) {
    const mapped = mapApiMessage(message, chatIndex, usernameOverrides)
    if (mapped) result.push(mapped)
  }

  return result
}

/** Channels/supergroups worth an extra channels.GetChannels round-trip: no
 *  username on the object we got from search (a "min" constructor omits it),
 *  but we do have enough (id + accessHash) to build an InputChannel and ask
 *  Telegram for the full object. De-duplicated by chatId within the input list. */
export function findChannelsNeedingUsernameResolve(chats: Api.TypeChat[]): Api.Channel[] {
  const seen = new Set<string>()
  const result: Api.Channel[] = []

  for (const chat of chats) {
    if (!(chat instanceof Api.Channel)) continue
    if (extractPrimaryUsername(chat)) continue
    if (chat.accessHash == null) continue

    const chatId = chat.id.toString()
    if (seen.has(chatId)) continue
    seen.add(chatId)
    result.push(chat)
  }

  return result
}

/** Builds a chatId -> username map from a channels.GetChannels response —
 *  only for channels that actually came back with a username; a channel that
 *  genuinely has none (still no username after a full resolve) is simply
 *  absent from the map, never given a fabricated value. */
export function mapResolvedChannelsToUsernameOverrides(resolvedChats: Api.TypeChat[]): Map<string, string> {
  const overrides = new Map<string, string>()

  for (const chat of resolvedChats) {
    if (!(chat instanceof Api.Channel)) continue
    const username = extractPrimaryUsername(chat)
    if (username) overrides.set(chat.id.toString(), username)
  }

  return overrides
}

/** Candidate channel/group entity from contacts.Search — no messages involved. */
export interface TelegramEntityCandidate {
  chatId: string
  username: string | null
  title: string | null
  entityType: TelegramEntityType
}

export function mapChatToCandidate(chat: Api.TypeChat): TelegramEntityCandidate | null {
  const entityType = classifyEntityType(chat)
  if (!entityType) return null

  return {
    chatId: chat.id.toString(),
    username: chat instanceof Api.Channel ? chat.username ?? null : null,
    title: 'title' in chat ? chat.title ?? null : null,
    entityType
  }
}
