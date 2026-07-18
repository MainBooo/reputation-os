import { Injectable, Logger } from '@nestjs/common'
import { Api, errors, TelegramClient } from 'teleproto'
import { mapApiMessages, mapChatToCandidate, normalizeMessagesResponse, type TelegramEntityCandidate } from './telegram-api-mapper'
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

  async searchChannels(client: TelegramClient, options: GlobalSearchOptions): Promise<GlobalSearchResult> {
    return this.paginate(options, (offsetRate, offsetPeer, offsetId, limit) =>
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
    return this.paginate(options, (offsetRate, offsetPeer, offsetId, limit) =>
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

    return this.paginate(options, (offsetRate, offsetPeer, offsetId, limit) =>
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

      const mapped = mapApiMessages(rawMessages, response.chats ?? [])
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
