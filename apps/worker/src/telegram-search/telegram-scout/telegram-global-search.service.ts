import { Injectable, Logger } from '@nestjs/common'
import { Api, errors, TelegramClient } from 'teleproto'
import {
  findChannelsNeedingUsernameResolve,
  mapApiMessages,
  mapChatToCandidate,
  mapResolvedChannelsToUsernameOverrides,
  normalizeMessagesResponse,
  type TelegramEntityCandidate
} from './telegram-api-mapper'
import type { TelegramRawMessage, TelegramScoutRunStats } from './telegram-scout.types'
import { delay, searchDelayMs, searchResultsLimit, searchRetryAttempts, withRetry } from './telegram-retry.util'
import { isHashtagPostSearchEnabled } from './telegram-scout.config'

export type StoppedReason = TelegramScoutRunStats['stoppedReason']

export interface GlobalSearchResult {
  messages: TelegramRawMessage[]
  pagesFetched: number
  stoppedReason: StoppedReason
  floodWaitSeconds?: number
}

export interface GlobalSearchOptions {
  query: string
  maxPages: number
  /** How many more messages this DISCOVERY run may still collect overall — a
   *  running budget shared across all queries in the run, not per-query. */
  remainingMessageBudget: number
  pageSize?: number
}

@Injectable()
export class TelegramGlobalSearchService {
  private readonly logger = new Logger(TelegramGlobalSearchService.name)

  /** chatId -> resolved username (or null if a full resolve confirmed the channel
   *  genuinely has none). Lives for the lifetime of this singleton service, so a
   *  channel is resolved at most once across every discovery run, not just once
   *  per run — usernames essentially never change, so a long-lived cache entry
   *  going briefly stale after a rename is an acceptable trade-off for avoiding
   *  repeat channels.GetChannels calls. */
  private readonly resolvedUsernameCache = new Map<string, string | null>()

  async searchChannels(client: TelegramClient, options: GlobalSearchOptions): Promise<GlobalSearchResult> {
    return this.paginate(client, options, (offsetRate, offsetPeer, offsetId, limit) =>
      client.invoke(
        new Api.messages.SearchGlobal({
          broadcastsOnly: true,
          q: options.query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate,
          offsetPeer,
          offsetId,
          limit
        })
      )
    )
  }

  async searchGroups(client: TelegramClient, options: GlobalSearchOptions): Promise<GlobalSearchResult> {
    return this.paginate(client, options, (offsetRate, offsetPeer, offsetId, limit) =>
      client.invoke(
        new Api.messages.SearchGlobal({
          groupsOnly: true,
          q: options.query,
          filter: new Api.InputMessagesFilterEmpty(),
          minDate: 0,
          maxDate: 0,
          offsetRate,
          offsetPeer,
          offsetId,
          limit
        })
      )
    )
  }

  /** Free hashtag-only mode of channels.searchPosts — opt-in via ENV, never the
   *  paid full-text mode (see plan: Telegram Stars payment is out of scope for v1). */
  async searchHashtagPosts(client: TelegramClient, options: GlobalSearchOptions): Promise<GlobalSearchResult> {
    if (!isHashtagPostSearchEnabled()) {
      return { messages: [], pagesFetched: 0, stoppedReason: 'exhausted' }
    }

    const hashtag = options.query.replace(/^#/, '')

    return this.paginate(client, options, (offsetRate, offsetPeer, offsetId, limit) =>
      client.invoke(
        new Api.channels.SearchPosts({
          hashtag,
          offsetRate,
          offsetPeer,
          offsetId,
          limit
        })
      )
    )
  }

  /** Resolves the username for any channel in `chats` that search returned as a
   *  "min" constructor (no username, but id+accessHash present), via a single
   *  batched channels.GetChannels call for all of this page's unresolved chats.
   *  Already-resolved chatIds (successful or confirmed-no-username) are served
   *  from `resolvedUsernameCache` and never requested again. A failed resolve
   *  logs the affected chatIds and the technical reason only (no session/API
   *  secrets) and never throws — the caller proceeds with url:null for those
   *  channels, exactly as before this fix existed. */
  private async resolveUnresolvedUsernames(client: TelegramClient, chats: Api.TypeChat[]): Promise<Map<string, string>> {
    const overrides = new Map<string, string>()
    const candidates = findChannelsNeedingUsernameResolve(chats)
    const needsResolve: Api.Channel[] = []

    for (const chat of candidates) {
      const chatId = chat.id.toString()
      if (this.resolvedUsernameCache.has(chatId)) {
        const cached = this.resolvedUsernameCache.get(chatId)
        if (cached) overrides.set(chatId, cached)
        continue
      }
      needsResolve.push(chat)
    }

    if (needsResolve.length === 0) return overrides

    try {
      const inputChannels = needsResolve.map(
        (chat) => new Api.InputChannel({ channelId: chat.id, accessHash: chat.accessHash! })
      )
      const resolved = await withRetry(
        () => client.invoke(new Api.channels.GetChannels({ id: inputChannels })),
        searchRetryAttempts()
      )
      const resolvedOverrides = mapResolvedChannelsToUsernameOverrides(resolved.chats)

      for (const chat of needsResolve) {
        const chatId = chat.id.toString()
        const username = resolvedOverrides.get(chatId) ?? null
        this.resolvedUsernameCache.set(chatId, username)
        if (username) overrides.set(chatId, username)
      }
    } catch (error) {
      const chatIds = needsResolve.map((chat) => chat.id.toString()).join(',')
      const reason = error instanceof Error ? error.message : 'unknown'
      this.logger.warn(`Channel username resolve failed for chatIds=[${chatIds}]: ${reason}`)
    }

    return overrides
  }

  /** contacts.Search — entity discovery only (channels/groups/users by name),
   *  never treated as full-text message search. Users are filtered out; Scout
   *  only cares about public channels/groups. */
  async searchEntities(client: TelegramClient, query: string, limit: number): Promise<TelegramEntityCandidate[]> {
    try {
      const result = await withRetry(
        () => client.invoke(new Api.contacts.Search({ q: query, limit })),
        searchRetryAttempts()
      )

      const candidates: TelegramEntityCandidate[] = []
      for (const chat of result.chats) {
        const candidate = mapChatToCandidate(chat)
        if (candidate) candidates.push(candidate)
      }
      return candidates
    } catch (error) {
      this.logger.warn(`contacts.Search failed: ${error instanceof Error ? error.message : String(error)}`)
      return []
    }
  }

  private async paginate(
    client: TelegramClient,
    options: GlobalSearchOptions,
    invokePage: (
      offsetRate: number,
      offsetPeer: Api.TypeEntityLike,
      offsetId: number,
      limit: number
    ) => Promise<Api.messages.TypeMessages>
  ): Promise<GlobalSearchResult> {
    const pageSize = options.pageSize ?? searchResultsLimit()
    const messages: TelegramRawMessage[] = []

    let offsetRate = 0
    let offsetPeer: Api.TypeEntityLike = new Api.InputPeerEmpty()
    let offsetId = 0
    let pagesFetched = 0
    let stoppedReason: StoppedReason = 'exhausted'
    let floodWaitSeconds: number | undefined

    if (options.remainingMessageBudget <= 0) {
      return { messages, pagesFetched: 0, stoppedReason: 'max_messages' }
    }

    for (let page = 0; page < options.maxPages; page += 1) {
      let response: { messages: Api.TypeMessage[]; chats: Api.TypeChat[]; nextRate: number | null }
      try {
        const raw = await withRetry(
          () => invokePage(offsetRate, offsetPeer, offsetId, pageSize),
          searchRetryAttempts()
        )
        response = normalizeMessagesResponse(raw)
      } catch (error) {
        if (error instanceof errors.FloodWaitError) {
          stoppedReason = 'flood_wait'
          floodWaitSeconds = error.seconds
          break
        }
        throw error
      }

      pagesFetched += 1

      const rawMessages = response.messages ?? []
      if (rawMessages.length === 0) {
        stoppedReason = 'empty_page'
        break
      }

      const usernameOverrides = await this.resolveUnresolvedUsernames(client, response.chats ?? [])
      const mapped = mapApiMessages(rawMessages, response.chats ?? [], usernameOverrides)
      const remaining = options.remainingMessageBudget - messages.length

      if (mapped.length >= remaining) {
        messages.push(...mapped.slice(0, remaining))
        stoppedReason = 'max_messages'
        break
      }

      messages.push(...mapped)

      const lastMessage = rawMessages[rawMessages.length - 1]
      if (!(lastMessage instanceof Api.Message)) {
        stoppedReason = 'empty_page'
        break
      }

      offsetId = lastMessage.id
      offsetRate = response.nextRate ?? offsetRate
      offsetPeer = lastMessage.peerId as unknown as Api.TypeEntityLike

      if (page < options.maxPages - 1) await delay(searchDelayMs())
    }

    if (pagesFetched >= options.maxPages && stoppedReason === 'exhausted') {
      stoppedReason = 'max_pages'
    }

    return { messages, pagesFetched, stoppedReason, floodWaitSeconds }
  }
}
