import { Injectable, Logger } from '@nestjs/common'
import { Api, errors, TelegramClient } from 'teleproto'
import bigInt from 'big-integer'
import { mapApiMessages, normalizeMessagesResponse } from './telegram-api-mapper'
import type { TelegramRawMessage } from './telegram-scout.types'
import { delay, searchDelayMs, searchResultsLimit, searchRetryAttempts, withRetry } from './telegram-retry.util'
import type { StoppedReason, GlobalSearchResult } from './telegram-global-search.service'

export interface ChannelSearchTarget {
  chatId: string
  /** messages.Search on a specific peer requires resolving it — without a stored
   *  accessHash (see plan §3) this only works for public sources with a username. */
  username: string
}

export interface ChannelSearchOptions {
  /** Empty string searches the full text index of the peer (all messages). */
  query?: string
  /** Only return messages with id > minId — used for incremental watchlist reads. */
  minId?: number
  maxPages: number
  remainingMessageBudget: number
  pageSize?: number
}

@Injectable()
export class TelegramChannelSearchService {
  private readonly logger = new Logger(TelegramChannelSearchService.name)

  async searchWithinPeer(
    client: TelegramClient,
    target: ChannelSearchTarget,
    options: ChannelSearchOptions
  ): Promise<GlobalSearchResult> {
    const pageSize = options.pageSize ?? searchResultsLimit()
    const messages: TelegramRawMessage[] = []

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
          () =>
            client.invoke(
              new Api.messages.Search({
                peer: target.username,
                q: options.query ?? '',
                filter: new Api.InputMessagesFilterEmpty(),
                minDate: 0,
                maxDate: 0,
                offsetId,
                addOffset: 0,
                limit: pageSize,
                maxId: 0,
                minId: options.minId ?? 0,
                hash: bigInt(0)
              })
            ),
          searchRetryAttempts()
        )
        response = normalizeMessagesResponse(raw)
      } catch (error) {
        if (error instanceof errors.FloodWaitError) {
          stoppedReason = 'flood_wait'
          floodWaitSeconds = error.seconds
          break
        }
        this.logger.warn(`messages.Search failed for @${target.username}: ${(error as Error)?.message}`)
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

      // Walking strictly backward by id guarantees termination even if the
      // peer keeps receiving new messages while this page loop runs.
      if (lastMessage.id <= (options.minId ?? 0)) {
        stoppedReason = 'exhausted'
        break
      }

      offsetId = lastMessage.id

      if (page < options.maxPages - 1) await delay(searchDelayMs())
    }

    if (pagesFetched >= options.maxPages && stoppedReason === 'exhausted') {
      stoppedReason = 'max_pages'
    }

    return { messages, pagesFetched, stoppedReason, floodWaitSeconds }
  }
}
