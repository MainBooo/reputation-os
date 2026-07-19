import { Injectable, Logger } from '@nestjs/common'
import type { TelegramClient } from 'teleproto'
import { TelegramDiscoveryMethod } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { DedupService } from '../../services/dedup.service'
import { TelegramQueryBuilderService } from './telegram-query-builder.service'
import { TelegramGlobalSearchService } from './telegram-global-search.service'
import { TelegramChannelSearchService } from './telegram-channel-search.service'
import { TelegramRelevanceService } from './telegram-relevance.service'
import { TelegramMessageClassifierService } from './telegram-message-classifier.service'
import { resolveMessageRouting } from './telegram-message-routing.util'
import { TelegramScoutSourceService } from './telegram-scout-source.service'
import { buildRelevanceContext } from './telegram-relevance-context.util'
import { mapTelegramMessageToMentionParams } from './telegram-result-mapper'
import { loadTelegramScoutBudgets, messageClassifierHideThreshold, messageClassifierReviewThreshold } from './telegram-scout.config'
import type { TelegramMtprotoLockHandle } from '../mtproto-lock'
import type { RelevanceContext, TelegramQuery, TelegramRawMessage, TelegramScoutRunStats } from './telegram-scout.types'

interface CandidateChannel {
  chatId: string
  username: string | null
  title: string | null
  entityType: 'channel' | 'group' | 'supergroup'
  discoveryMethod: TelegramDiscoveryMethod
  matchedQuery: string
  yesCount: number
}

@Injectable()
export class TelegramScoutService {
  private readonly logger = new Logger(TelegramScoutService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly queryBuilder: TelegramQueryBuilderService,
    private readonly globalSearch: TelegramGlobalSearchService,
    private readonly channelSearch: TelegramChannelSearchService,
    private readonly relevance: TelegramRelevanceService,
    private readonly messageClassifier: TelegramMessageClassifierService,
    private readonly dedup: DedupService,
    private readonly scoutSource: TelegramScoutSourceService
  ) {}

  async runDiscovery(
    client: TelegramClient,
    companyId: string,
    lockHandle?: TelegramMtprotoLockHandle
  ): Promise<TelegramScoutRunStats> {
    const startedAt = Date.now()
    const budgets = loadTelegramScoutBudgets()

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, include: { aliases: true } })
    if (!company) throw new Error(`Company not found: ${companyId}`)

    const queries = this.queryBuilder.build({ company, aliases: company.aliases }, budgets)
    const context = buildRelevanceContext(company, company.aliases)
    const bootstrap = await this.scoutSource.ensureBootstrapTarget(companyId)

    const stats: TelegramScoutRunStats = {
      mode: 'discovery',
      companyId,
      queriesExecuted: [],
      pagesFetched: 0,
      messagesScanned: 0,
      mentionsConfirmed: 0,
      mentionsRejected: 0,
      mentionsUnsure: 0,
      mentionsHidden: 0,
      mentionsNeedReview: 0,
      newChannelsFound: 0,
      newGroupsFound: 0,
      stoppedReason: null
    }

    const candidates = new Map<string, CandidateChannel>()
    let remainingMessageBudget = budgets.maxMessagesPerRun

    const isOutOfTime = () => Date.now() - startedAt > budgets.maxRuntimeMs

    queryLoop: for (const query of queries) {
      lockHandle?.assertHeld()

      if (isOutOfTime()) {
        stats.stoppedReason = 'max_runtime'
        break
      }
      if (remainingMessageBudget <= 0) {
        stats.stoppedReason = 'max_messages'
        break
      }

      stats.queriesExecuted.push({ text: query.text, class: query.class })
      const isWeakQuery = query.class === 'weak'

      const searches = [
        () => this.globalSearch.searchChannels(client, { query: query.text, maxPages: budgets.maxPagesPerQuery, remainingMessageBudget }),
        () => this.globalSearch.searchGroups(client, { query: query.text, maxPages: budgets.maxPagesPerQuery, remainingMessageBudget }),
        () => this.globalSearch.searchHashtagPosts(client, { query: query.text, maxPages: budgets.maxPagesPerQuery, remainingMessageBudget })
      ]

      for (const search of searches) {
        if (remainingMessageBudget <= 0 || isOutOfTime()) break

        const result = await search()
        stats.pagesFetched += result.pagesFetched
        stats.messagesScanned += result.messages.length
        remainingMessageBudget -= result.messages.length

        await this.evaluateMessages(result.messages, context, query, TelegramDiscoveryMethod.GLOBAL_CHANNEL_SEARCH, {
          companyId,
          sourceId: bootstrap.sourceId,
          companySourceTargetId: bootstrap.companySourceTargetId,
          stats,
          candidates
        })

        if (result.stoppedReason === 'flood_wait') {
          stats.stoppedReason = 'flood_wait'
          stats.floodWaitSeconds = result.floodWaitSeconds
          break queryLoop
        }
      }
    }

    // Entity discovery (contacts.Search) — name-only, no messages. Adds more
    // deep-search candidates for channels a keyword search might miss.
    if (!isOutOfTime() && remainingMessageBudget > 0 && queries.length > 0) {
      const topQuery = queries[0].text
      const entities = await this.globalSearch.searchEntities(client, topQuery, 10)
      for (const entity of entities) {
        if (!entity.username) continue
        if (!candidates.has(entity.chatId)) {
          candidates.set(entity.chatId, {
            chatId: entity.chatId,
            username: entity.username,
            title: entity.title,
            entityType: entity.entityType,
            discoveryMethod: TelegramDiscoveryMethod.ENTITY_SEARCH,
            matchedQuery: topQuery,
            yesCount: 0
          })
        }
      }
    }

    // Deep search inside every candidate channel found above (plan §"Углублённый поиск").
    if (stats.stoppedReason === null) {
      for (const candidate of candidates.values()) {
        lockHandle?.assertHeld()

        if (!candidate.username) continue
        if (remainingMessageBudget <= 0) {
          stats.stoppedReason = 'max_messages'
          break
        }
        if (isOutOfTime()) {
          stats.stoppedReason = 'max_runtime'
          break
        }

        const deep = await this.channelSearch.searchWithinPeer(
          client,
          { chatId: candidate.chatId, username: candidate.username },
          { minId: 0, maxPages: budgets.maxPagesPerQuery, remainingMessageBudget }
        )

        stats.pagesFetched += deep.pagesFetched
        stats.messagesScanned += deep.messages.length
        remainingMessageBudget -= deep.messages.length

        await this.evaluateMessages(
          deep.messages,
          context,
          { text: candidate.matchedQuery, class: 'medium' },
          candidate.discoveryMethod,
          {
            companyId,
            sourceId: bootstrap.sourceId,
            companySourceTargetId: bootstrap.companySourceTargetId,
            stats,
            candidates
          }
        )

        if (deep.stoppedReason === 'flood_wait') {
          stats.stoppedReason = 'flood_wait'
          stats.floodWaitSeconds = deep.floodWaitSeconds
          break
        }
      }
    }

    if (stats.stoppedReason === null) stats.stoppedReason = 'exhausted'

    await this.promoteCandidates(companyId, candidates, bootstrap.autoAddToWatchlist, stats, budgets.maxNewSourcesPerRun)

    return stats
  }

  /** Lightweight ENTITY_SEARCH mode — contacts.Search only, no message scanning.
   *  Candidates are always created with yesCount=0 (no confirmed mention), so they
   *  can never auto-enable — a human always confirms them in the UI. */
  async runEntitySearch(
    client: TelegramClient,
    companyId: string,
    lockHandle?: TelegramMtprotoLockHandle
  ): Promise<TelegramScoutRunStats> {
    const budgets = loadTelegramScoutBudgets()

    const company = await this.prisma.company.findUnique({ where: { id: companyId }, include: { aliases: true } })
    if (!company) throw new Error(`Company not found: ${companyId}`)

    const queries = this.queryBuilder.build({ company, aliases: company.aliases }, budgets)
    const bootstrap = await this.scoutSource.ensureBootstrapTarget(companyId)

    const stats: TelegramScoutRunStats = {
      mode: 'entity_search',
      companyId,
      queriesExecuted: queries.map((q) => ({ text: q.text, class: q.class })),
      pagesFetched: 0,
      messagesScanned: 0,
      mentionsConfirmed: 0,
      mentionsRejected: 0,
      mentionsUnsure: 0,
      mentionsHidden: 0,
      mentionsNeedReview: 0,
      newChannelsFound: 0,
      newGroupsFound: 0,
      stoppedReason: 'exhausted'
    }

    const candidates = new Map<string, CandidateChannel>()

    for (const query of queries) {
      lockHandle?.assertHeld()

      const entities = await this.globalSearch.searchEntities(client, query.text, 10)
      for (const entity of entities) {
        if (!entity.username || candidates.has(entity.chatId)) continue
        candidates.set(entity.chatId, {
          chatId: entity.chatId,
          username: entity.username,
          title: entity.title,
          entityType: entity.entityType,
          discoveryMethod: TelegramDiscoveryMethod.ENTITY_SEARCH,
          matchedQuery: query.text,
          yesCount: 0
        })
      }
    }

    // yesCount is always 0 here, so promoteCandidates would normally skip every
    // candidate (see its `if (candidate.yesCount === 0) continue` guard) — entity
    // search candidates are added as pure suggestions instead, unconditionally disabled.
    let newSourcesCreated = 0
    for (const candidate of candidates.values()) {
      if (newSourcesCreated >= budgets.maxNewSourcesPerRun) break

      const telegramChannel = await this.prisma.telegramChannel.upsert({
        where: { chatId: candidate.chatId },
        create: {
          chatId: candidate.chatId,
          username: candidate.username,
          title: candidate.title,
          entityType: candidate.entityType
        },
        update: { username: candidate.username ?? undefined, title: candidate.title ?? undefined }
      })

      const existingLink = await this.prisma.companyTelegramChannel.findUnique({
        where: { companyId_telegramChannelId: { companyId, telegramChannelId: telegramChannel.id } }
      })
      if (existingLink) continue

      await this.prisma.companyTelegramChannel.create({
        data: {
          companyId,
          telegramChannelId: telegramChannel.id,
          enabled: false,
          discoveryMethod: TelegramDiscoveryMethod.ENTITY_SEARCH,
          matchedQuery: candidate.matchedQuery
        }
      })

      newSourcesCreated += 1
      if (candidate.entityType === 'channel') stats.newChannelsFound += 1
      else stats.newGroupsFound += 1
    }

    void bootstrap // bootstrap target still ensured for billing/consistency even though no mentions are persisted here.

    return stats
  }

  private async evaluateMessages(
    messages: TelegramRawMessage[],
    context: RelevanceContext,
    query: TelegramQuery,
    discoveryMethod: TelegramDiscoveryMethod,
    ctx: {
      companyId: string
      sourceId: string
      companySourceTargetId: string
      stats: TelegramScoutRunStats
      candidates: Map<string, CandidateChannel>
    }
  ) {
    const thresholds = { reviewThreshold: messageClassifierReviewThreshold(), hideThreshold: messageClassifierHideThreshold() }

    for (const message of messages) {
      const preFilter = this.relevance.preFilter(message.text, context, query.class === 'weak')

      if (!preFilter.passesPreFilter) {
        ctx.stats.mentionsRejected += 1
        continue
      }

      const classification = await this.messageClassifier.classify({
        context,
        messageText: message.text,
        matchedQuery: query.text,
        channelTitle: message.title,
        channelUsername: message.username,
        entityType: message.entityType,
        channelClassification: null,
        exactHit: preFilter.exactHit
      })

      const type = classification.ok ? classification.type : null
      const confidence = classification.ok ? classification.confidence : 0
      const routing = resolveMessageRouting(type, confidence, thresholds)

      // Every message that passes the pre-filter is persisted as a Mention — the
      // audit principle (plan §3): nothing after this point is silently dropped,
      // visibility is controlled solely by isInboxVisible/needsManualReview.
      try {
        const params = mapTelegramMessageToMentionParams({
          message,
          matchedQuery: query.text,
          preFilter,
          classification,
          routing,
          companyId: ctx.companyId,
          sourceId: ctx.sourceId,
          companySourceTargetId: ctx.companySourceTargetId
        })
        await this.dedup.persistMention(params)
        ctx.stats.mentionsConfirmed += 1
        if (!routing.isInboxVisible) ctx.stats.mentionsHidden += 1
        if (routing.needsManualReview) ctx.stats.mentionsNeedReview += 1
      } catch (error) {
        this.logger.warn(`Failed to persist Telegram mention: ${error instanceof Error ? error.message : String(error)}`)
        continue
      }

      // A technical classifier failure never suppresses channel discovery — only a
      // confident IRRELEVANT/SPAM verdict does (plan §"Продвижение кандидата-канала").
      const countsAsCandidateHit = !classification.ok || (type !== 'IRRELEVANT' && type !== 'SPAM')
      if (!countsAsCandidateHit) continue

      const existing = ctx.candidates.get(message.chatId)
      if (existing) {
        existing.yesCount += 1
      } else {
        ctx.candidates.set(message.chatId, {
          chatId: message.chatId,
          username: message.username,
          title: message.title,
          entityType: message.entityType,
          discoveryMethod,
          matchedQuery: query.text,
          yesCount: 1
        })
      }
    }
  }

  private async promoteCandidates(
    companyId: string,
    candidates: Map<string, CandidateChannel>,
    autoAddToWatchlist: boolean,
    stats: TelegramScoutRunStats,
    maxNewSources: number
  ) {
    let newSourcesCreated = 0

    for (const candidate of candidates.values()) {
      if (candidate.yesCount === 0) continue
      if (newSourcesCreated >= maxNewSources) break

      const telegramChannel = await this.prisma.telegramChannel.upsert({
        where: { chatId: candidate.chatId },
        create: {
          chatId: candidate.chatId,
          username: candidate.username,
          title: candidate.title,
          entityType: candidate.entityType
        },
        update: {
          username: candidate.username ?? undefined,
          title: candidate.title ?? undefined
        }
      })

      const existingLink = await this.prisma.companyTelegramChannel.findUnique({
        where: { companyId_telegramChannelId: { companyId, telegramChannelId: telegramChannel.id } }
      })

      if (existingLink) continue

      const shouldAutoEnable = autoAddToWatchlist && candidate.yesCount >= 2

      await this.prisma.companyTelegramChannel.create({
        data: {
          companyId,
          telegramChannelId: telegramChannel.id,
          enabled: shouldAutoEnable,
          // The dispatcher's due-query is `nextCheckAt <= now`, which SQL never
          // matches against NULL — an enabled row needs an immediate due date or
          // it would never be picked up.
          nextCheckAt: shouldAutoEnable ? new Date() : null,
          discoveryMethod: candidate.discoveryMethod,
          matchedQuery: candidate.matchedQuery,
          relevanceScore: null
        }
      })

      newSourcesCreated += 1
      if (candidate.entityType === 'channel') stats.newChannelsFound += 1
      else stats.newGroupsFound += 1
    }
  }
}
