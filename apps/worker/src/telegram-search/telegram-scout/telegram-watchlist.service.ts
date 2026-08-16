import { Injectable, Logger } from '@nestjs/common'
import type { Company, CompanyAlias, CompanyTelegramChannel, TelegramChannel } from '@prisma/client'
import { TelegramDiscoveryMethod } from '@prisma/client'
import { Api, TelegramClient } from 'teleproto'
import { classifyEntityType } from './telegram-api-mapper'
import { PrismaService } from '../../common/prisma/prisma.service'
import { DedupService } from '../../services/dedup.service'
import { TelegramChannelSearchService } from './telegram-channel-search.service'
import { TelegramRelevanceService } from './telegram-relevance.service'
import { TelegramMessageClassifierService } from './telegram-message-classifier.service'
import { resolveMessageRouting } from './telegram-message-routing.util'
import { TelegramScoutSourceService } from './telegram-scout-source.service'
import { buildRelevanceContext } from './telegram-relevance-context.util'
import { mapTelegramMessageToMentionParams } from './telegram-result-mapper'
import { searchResultsLimit } from './telegram-retry.util'
import { messageClassifierHideThreshold, messageClassifierReviewThreshold, watchlistMaxMessagesPerChannel } from './telegram-scout.config'
import type { TelegramMtprotoLockHandle } from '../mtproto-lock'
import type { TelegramRawMessage } from './telegram-scout.types'
import { JobEligibilityService } from '../../services/job-eligibility.service'

export class TelegramUsernameInvalidError extends Error {
  constructor(public readonly username: string) {
    super(`Invalid Telegram username: "${username}"`)
    this.name = 'TelegramUsernameInvalidError'
  }
}

export class TelegramUsernameNotFoundError extends Error {
  constructor(public readonly username: string, cause: string) {
    super(`Telegram username @${username} could not be resolved: ${cause}`)
    this.name = 'TelegramUsernameNotFoundError'
  }
}

export class TelegramNotChannelOrGroupError extends Error {
  constructor(public readonly username: string) {
    super(`@${username} is not a public channel, group, or supergroup`)
    this.name = 'TelegramNotChannelOrGroupError'
  }
}

export class TelegramNotPublicError extends Error {
  constructor(public readonly username: string) {
    super(`@${username} resolved but has no public username`)
    this.name = 'TelegramNotPublicError'
  }
}

export interface WatchlistCompanyError {
  companyId: string
  companyTelegramChannelId: string
  message: string
}

export interface WatchlistProcessResult {
  telegramChannelId: string
  companiesProcessed: number
  mentionsFound: number
  /** Breakdown of mentionsFound — see TelegramScoutRunStats for field meanings;
   *  mirrored here so the daily discovery run (phase 4) can aggregate them
   *  into the same run-level counters used by the global-search phases. */
  messagesScanned: number
  candidateMessages: number
  messagesClassified: number
  relevantMessages: number
  mentionsCreated: number
  duplicatesSkipped: number
  aiClassificationErrors: number
  errors: WatchlistCompanyError[]
  stoppedReason: 'ok' | 'flood_wait' | 'no_public_username' | 'no_enabled_companies'
  floodWaitSeconds?: number
}

interface CompanyEntry {
  companyTelegramChannelId: string
  companyId: string
  company: Company
  aliases: CompanyAlias[]
  lastMessageId: number | null
  matchedQuery: string | null
}

@Injectable()
export class TelegramWatchlistService {
  private readonly logger = new Logger(TelegramWatchlistService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly channelSearch: TelegramChannelSearchService,
    private readonly relevance: TelegramRelevanceService,
    private readonly messageClassifier: TelegramMessageClassifierService,
    private readonly dedup: DedupService,
    private readonly scoutSource: TelegramScoutSourceService,
    private readonly eligibility: JobEligibilityService
  ) {}

  async processChannel(
    client: TelegramClient,
    telegramChannelId: string,
    lockHandle?: TelegramMtprotoLockHandle
  ): Promise<WatchlistProcessResult> {
    const channel = await this.prisma.telegramChannel.findUnique({ where: { id: telegramChannelId } })

    const zeroCounters = {
      messagesScanned: 0,
      candidateMessages: 0,
      messagesClassified: 0,
      relevantMessages: 0,
      mentionsCreated: 0,
      duplicatesSkipped: 0,
      aiClassificationErrors: 0
    }

    if (!channel) {
      return {
        telegramChannelId,
        companiesProcessed: 0,
        mentionsFound: 0,
        ...zeroCounters,
        errors: [],
        stoppedReason: 'no_enabled_companies'
      }
    }

    const eligibleLinkIds = await this.eligibility.getEligibleTelegramLinkIds(telegramChannelId)
    const links = await this.prisma.companyTelegramChannel.findMany({
      where: { telegramChannelId, enabled: true, id: { in: eligibleLinkIds } },
      include: { company: { include: { aliases: true } } }
    })

    if (links.length === 0) {
      return { telegramChannelId, companiesProcessed: 0, mentionsFound: 0, ...zeroCounters, errors: [], stoppedReason: 'no_enabled_companies' }
    }

    if (!channel.username) {
      // Without a stored accessHash (plan §3) a per-peer deep search can only resolve
      // via a public username — a channel that lost its username can't be read here.
      this.logger.warn(`TelegramChannel ${telegramChannelId} has no public username — skipping watchlist read`)
      return {
        telegramChannelId,
        companiesProcessed: 0,
        mentionsFound: 0,
        ...zeroCounters,
        errors: [],
        stoppedReason: 'no_public_username'
      }
    }

    const entries: CompanyEntry[] = links.map((link) => ({
      companyTelegramChannelId: link.id,
      companyId: link.companyId,
      company: link.company,
      aliases: link.company.aliases,
      lastMessageId: link.lastMessageId,
      matchedQuery: link.matchedQuery
    }))

    const newJoiners = entries.filter((e) => e.lastMessageId == null)
    const withCursor = entries.filter((e) => e.lastMessageId != null)

    const errors: WatchlistCompanyError[] = []
    let mentionsFound = 0
    let stoppedReason: WatchlistProcessResult['stoppedReason'] = 'ok'
    let floodWaitSeconds: number | undefined
    const counters = { ...zeroCounters }

    if (newJoiners.length > 0) {
      const backfillPageSize = searchResultsLimit()
      const backfill = await this.channelSearch.searchWithinPeer(
        client,
        { chatId: channel.chatId, username: channel.username },
        { minId: 0, maxPages: 1, remainingMessageBudget: backfillPageSize, pageSize: backfillPageSize }
      )

      // Counted once per fetch, not per company sharing the channel — these are
      // the same raw messages handed to every newJoiner entry below.
      counters.messagesScanned += backfill.messages.length

      if (backfill.stoppedReason === 'flood_wait') {
        stoppedReason = 'flood_wait'
        floodWaitSeconds = backfill.floodWaitSeconds
      }

      for (const entry of newJoiners) {
        lockHandle?.assertHeld()
        const outcome = await this.processCompanyMessages(entry, backfill.messages, null)
        mentionsFound += outcome.mentionsFound
        if (outcome.error) errors.push(outcome.error)
        this.addOutcomeCounters(counters, outcome)

        await this.prisma.companyTelegramChannel.update({
          where: { id: entry.companyTelegramChannelId },
          data: {
            lastMessageId: outcome.lastGoodId ?? 0,
            lastCheckedAt: new Date(),
            consecutiveErrors: outcome.error ? { increment: 1 } : 0,
            lastError: outcome.error?.message ?? null
          }
        })
      }
    }

    if (withCursor.length > 0) {
      const minCursor = Math.min(...withCursor.map((e) => e.lastMessageId as number))
      const maxMessages = watchlistMaxMessagesPerChannel()
      const pageSize = searchResultsLimit()
      const maxPages = Math.max(1, Math.ceil(maxMessages / pageSize))

      const page = await this.channelSearch.searchWithinPeer(
        client,
        { chatId: channel.chatId, username: channel.username },
        { minId: minCursor, maxPages, remainingMessageBudget: maxMessages, pageSize }
      )

      counters.messagesScanned += page.messages.length

      if (page.stoppedReason === 'flood_wait') {
        stoppedReason = 'flood_wait'
        floodWaitSeconds = page.floodWaitSeconds
      }

      const maxIdSeen = page.messages.reduce((max, m) => Math.max(max, m.id), minCursor)
      await this.prisma.telegramChannel.update({
        where: { id: telegramChannelId },
        data: { lastFetchedMessageId: maxIdSeen, lastFetchedAt: new Date() }
      })

      for (const entry of withCursor) {
        lockHandle?.assertHeld()
        const ownMessages = page.messages.filter((m) => m.id > (entry.lastMessageId as number))
        const outcome = await this.processCompanyMessages(entry, ownMessages, entry.lastMessageId)
        mentionsFound += outcome.mentionsFound
        if (outcome.error) errors.push(outcome.error)
        this.addOutcomeCounters(counters, outcome)

        // Advance strictly to the last message this company processed without error —
        // never past a failure, so a failed message is retried next cycle (plan §2).
        const nextCursor = outcome.lastGoodId ?? (entry.lastMessageId as number)

        await this.prisma.companyTelegramChannel.update({
          where: { id: entry.companyTelegramChannelId },
          data: {
            lastMessageId: nextCursor,
            lastCheckedAt: new Date(),
            consecutiveErrors: outcome.error ? { increment: 1 } : 0,
            lastError: outcome.error?.message ?? null
          }
        })
      }
    }

    return {
      telegramChannelId,
      companiesProcessed: entries.length,
      mentionsFound,
      ...counters,
      errors,
      stoppedReason,
      floodWaitSeconds
    }
  }

  private addOutcomeCounters(
    counters: {
      candidateMessages: number
      messagesClassified: number
      relevantMessages: number
      mentionsCreated: number
      duplicatesSkipped: number
      aiClassificationErrors: number
    },
    outcome: Awaited<ReturnType<TelegramWatchlistService['processCompanyMessages']>>
  ): void {
    counters.candidateMessages += outcome.candidateMessages
    counters.messagesClassified += outcome.messagesClassified
    counters.relevantMessages += outcome.relevantMessages
    counters.mentionsCreated += outcome.mentionsCreated
    counters.duplicatesSkipped += outcome.duplicatesSkipped
    counters.aiClassificationErrors += outcome.aiClassificationErrors
  }

  /** Manual "add by username" flow (API POST .../telegram-channels). Resolves a
   *  public username to a real entity, verifies it's a channel/group/supergroup
   *  (never a user), and links it to the company — enabled immediately, since a
   *  human explicitly asked for this one, unlike DISCOVERY's auto-created candidates. */
  async resolveAndLinkChannel(
    client: TelegramClient,
    companyId: string,
    rawUsername: string
  ): Promise<{ telegramChannel: TelegramChannel; companyTelegramChannel: CompanyTelegramChannel }> {
    const username = rawUsername.replace(/^@/, '').trim()
    if (!username) throw new TelegramUsernameInvalidError(rawUsername)

    const entity = await client.getEntity(username).catch((error: unknown) => {
      throw new TelegramUsernameNotFoundError(username, error instanceof Error ? error.message : String(error))
    })

    if (!(entity instanceof Api.Channel) && !(entity instanceof Api.Chat)) {
      throw new TelegramNotChannelOrGroupError(username)
    }

    const entityType = classifyEntityType(entity)
    if (!entityType) throw new TelegramNotChannelOrGroupError(username)

    const resolvedUsername = entity instanceof Api.Channel ? entity.username ?? null : null
    if (!resolvedUsername) throw new TelegramNotPublicError(username)

    const title = 'title' in entity ? entity.title ?? null : null
    const chatId = entity.id.toString()

    const telegramChannel = await this.prisma.telegramChannel.upsert({
      where: { chatId },
      create: { chatId, username: resolvedUsername, title, entityType },
      update: { username: resolvedUsername, title }
    })

    const existing = await this.prisma.companyTelegramChannel.findUnique({
      where: { companyId_telegramChannelId: { companyId, telegramChannelId: telegramChannel.id } }
    })

    const companyTelegramChannel = existing
      ? await this.prisma.companyTelegramChannel.update({
          where: { id: existing.id },
          data: { enabled: true, nextCheckAt: new Date() }
        })
      : await this.prisma.companyTelegramChannel.create({
          data: {
            companyId,
            telegramChannelId: telegramChannel.id,
            enabled: true,
            nextCheckAt: new Date(),
            discoveryMethod: TelegramDiscoveryMethod.MANUAL,
            matchedQuery: null
          }
        })

    return { telegramChannel, companyTelegramChannel }
  }

  private async processCompanyMessages(
    entry: CompanyEntry,
    messages: TelegramRawMessage[],
    initialCursor: number | null
  ): Promise<{
    mentionsFound: number
    lastGoodId: number | null
    error?: WatchlistCompanyError
    candidateMessages: number
    messagesClassified: number
    relevantMessages: number
    mentionsCreated: number
    duplicatesSkipped: number
    aiClassificationErrors: number
  }> {
    const sorted = [...messages].sort((a, b) => a.id - b.id)
    let mentionsFound = 0
    let lastGoodId: number | null = null
    let candidateMessages = 0
    let messagesClassified = 0
    let relevantMessages = 0
    let mentionsCreated = 0
    let duplicatesSkipped = 0
    let aiClassificationErrors = 0

    const context = buildRelevanceContext(entry.company, entry.aliases)
    const thresholds = { reviewThreshold: messageClassifierReviewThreshold(), hideThreshold: messageClassifierHideThreshold() }

    for (const message of sorted) {
      try {
        const preFilter = this.relevance.preFilter(message.text, context, false)

        if (preFilter.passesPreFilter) {
          candidateMessages += 1

          const classification = await this.messageClassifier.classify({
            context,
            messageText: message.text,
            matchedQuery: entry.matchedQuery ?? entry.company.name,
            channelTitle: message.title,
            channelUsername: message.username,
            entityType: message.entityType,
            channelClassification: null,
            exactHit: preFilter.exactHit
          })
          messagesClassified += 1
          if (!classification.ok) aiClassificationErrors += 1
          else if (classification.decision !== 'NO') relevantMessages += 1

          const type = classification.ok ? classification.type : null
          const confidence = classification.ok ? classification.confidence : 0
          const decision = classification.ok ? classification.decision : null
          const routing = resolveMessageRouting(type, confidence, thresholds, decision)

          const bootstrap = await this.scoutSource.ensureBootstrapTarget(entry.companyId)
          const params = mapTelegramMessageToMentionParams({
            message,
            matchedQuery: entry.matchedQuery ?? entry.company.name,
            preFilter,
            classification,
            routing,
            companyId: entry.companyId,
            sourceId: bootstrap.sourceId,
            companySourceTargetId: bootstrap.companySourceTargetId
          })
          const persisted = await this.dedup.persistMention(params)
          // DedupService.persistMention() doesn't report create-vs-merge directly
          // (out of scope to change its signature — shared by every other platform
          // too) — a freshly created row's createdAt/updatedAt are set by the same
          // INSERT statement and are therefore identical; an update always moves
          // updatedAt forward while createdAt stays put, so this is a safe,
          // non-invasive way to tell the two cases apart from the caller side.
          if (persisted.createdAt.getTime() === persisted.updatedAt.getTime()) {
            mentionsCreated += 1
          } else {
            duplicatesSkipped += 1
          }
          mentionsFound += 1

          await this.prisma.companyTelegramChannel.update({
            where: { id: entry.companyTelegramChannelId },
            data: { mentionsFoundCount: { increment: 1 } }
          })
        }

        lastGoodId = message.id
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Watchlist processing failed for company ${entry.companyId} at message ${message.id}: ${errorMessage}`)
        return {
          mentionsFound,
          lastGoodId,
          error: { companyId: entry.companyId, companyTelegramChannelId: entry.companyTelegramChannelId, message: errorMessage },
          candidateMessages,
          messagesClassified,
          relevantMessages,
          mentionsCreated,
          duplicatesSkipped,
          aiClassificationErrors
        }
      }
    }

    return {
      mentionsFound,
      lastGoodId: lastGoodId ?? initialCursor,
      candidateMessages,
      messagesClassified,
      relevantMessages,
      mentionsCreated,
      duplicatesSkipped,
      aiClassificationErrors
    }
  }
}
