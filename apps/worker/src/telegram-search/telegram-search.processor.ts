import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { JobLogService } from '../services/job-log.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { WORKER_OPTIONS } from '../queues/job-options'
import { getTelegramSearchClient } from './client'
import { withTelegramMtprotoLock } from './mtproto-lock'
import { TelegramScoutService } from './telegram-scout/telegram-scout.service'
import {
  TelegramNotChannelOrGroupError,
  TelegramNotPublicError,
  TelegramUsernameInvalidError,
  TelegramUsernameNotFoundError,
  TelegramWatchlistService
} from './telegram-scout/telegram-watchlist.service'
import { isTelegramScoutEnabled, lockMaxSelfRequeues, lockRetryDelayMs } from './telegram-scout/telegram-scout.config'
import type { TelegramScoutMode, TelegramScoutRunStats } from './telegram-scout/telegram-scout.types'
import type { WatchlistProcessResult } from './telegram-scout/telegram-watchlist.service'

interface TelegramSearchJobData {
  mode: TelegramScoutMode
  companyId?: string
  telegramChannelId?: string
  /** source_check only — manual "add by username" resolve, as opposed to a
   *  recheck of an existing telegramChannelId. */
  username?: string
  lockRetryCount?: number
  originalJobId?: string
}

export interface ResolveChannelResult {
  ok: boolean
  reason?: 'invalid_username' | 'not_found' | 'not_channel_or_group' | 'not_public'
  message?: string
  telegramChannelId?: string
  companyTelegramChannelId?: string
}

type ModeResult = TelegramScoutRunStats | WatchlistProcessResult | ResolveChannelResult

@Injectable()
export class TelegramSearchProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramSearchProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly redis: any,
    @Inject('BULLMQ_WORKER_CONNECTION_FACTORY') private readonly workerConnectionFactory: () => any,
    @Inject(`QUEUE_${QUEUES.TELEGRAM_SEARCH}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly jobLogService: JobLogService,
    private readonly scoutService: TelegramScoutService,
    private readonly watchlistService: TelegramWatchlistService
  ) {}

  async onModuleInit() {
    const connection = this.workerConnectionFactory()
    this.worker = new Worker(QUEUES.TELEGRAM_SEARCH, async (job: Job) => this.handle(job), {
      connection,
      ...WORKER_OPTIONS.telegramSearch
    })
    this.worker.on('error', (err) => this.logger.error(`Worker error: ${err?.message}`))
    this.worker.on('failed', (job, err) => this.logger.error(`Job ${job?.id} failed: ${err?.message}`))
    await this.worker.waitUntilReady()
    this.logger.log('TelegramSearch worker READY')
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job<TelegramSearchJobData>) {
    const { mode } = job.data
    const startedAt = new Date()

    if (!isTelegramScoutEnabled()) {
      this.logger.log(`Telegram Scout disabled (TELEGRAM_SCOUT_ENABLED!=true) — skipping job ${job.id}`)
      return { skipped: true, reason: 'telegram_scout_disabled' }
    }

    let client
    try {
      client = await getTelegramSearchClient()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.jobLogService
        .finish({
          companyId: job.data.companyId ?? null,
          queueName: QUEUES.TELEGRAM_SEARCH,
          jobName: job.name,
          bullJobId: job.id,
          status: 'FAILED',
          startedAt,
          errorMessage: message,
          result: { mode, reason: 'mtproto_connect_failed' }
        })
        .catch(() => null)
      throw error
    }

    const lockResult = await withTelegramMtprotoLock(this.redis, String(job.id), mode, (handle) =>
      this.runMode(mode, job.data, client, handle)
    )

    if (!lockResult.ok) {
      return this.handleLockFailure(job, mode, lockResult.reason, startedAt)
    }

    const status = this.computeStatus(mode, lockResult.result)

    await this.jobLogService
      .finish({
        companyId: job.data.companyId ?? null,
        queueName: QUEUES.TELEGRAM_SEARCH,
        jobName: job.name,
        bullJobId: job.id,
        status,
        startedAt,
        result: { mode, ...lockResult.result }
      })
      .catch(() => null)

    return lockResult.result
  }

  private async runMode(
    mode: TelegramScoutMode,
    data: TelegramSearchJobData,
    client: Awaited<ReturnType<typeof getTelegramSearchClient>>,
    handle: Parameters<Parameters<typeof withTelegramMtprotoLock>[3]>[0]
  ): Promise<ModeResult> {
    switch (mode) {
      case 'discovery':
        if (!data.companyId) throw new Error('discovery job requires companyId')
        return this.scoutService.runDiscovery(client, data.companyId, handle)
      case 'entity_search':
        if (!data.companyId) throw new Error('entity_search job requires companyId')
        return this.scoutService.runEntitySearch(client, data.companyId, handle)
      case 'watchlist':
        if (!data.telegramChannelId) throw new Error('watchlist job requires telegramChannelId')
        return this.watchlistService.processChannel(client, data.telegramChannelId, handle)
      case 'source_check':
        if (data.username) {
          if (!data.companyId) throw new Error('source_check by username requires companyId')
          return this.resolveChannelByUsername(data.companyId, data.username, client)
        }
        if (!data.telegramChannelId) throw new Error('source_check job requires telegramChannelId or username')
        return this.watchlistService.processChannel(client, data.telegramChannelId, handle)
      default:
        throw new Error(`Unknown Telegram Scout mode: ${mode}`)
    }
  }

  private async resolveChannelByUsername(
    companyId: string,
    username: string,
    client: Awaited<ReturnType<typeof getTelegramSearchClient>>
  ): Promise<ResolveChannelResult> {
    try {
      const { telegramChannel, companyTelegramChannel } = await this.watchlistService.resolveAndLinkChannel(
        client,
        companyId,
        username
      )
      return { ok: true, telegramChannelId: telegramChannel.id, companyTelegramChannelId: companyTelegramChannel.id }
    } catch (error) {
      if (error instanceof TelegramUsernameInvalidError) return { ok: false, reason: 'invalid_username', message: error.message }
      if (error instanceof TelegramUsernameNotFoundError) return { ok: false, reason: 'not_found', message: error.message }
      if (error instanceof TelegramNotChannelOrGroupError) return { ok: false, reason: 'not_channel_or_group', message: error.message }
      if (error instanceof TelegramNotPublicError) return { ok: false, reason: 'not_public', message: error.message }
      throw error
    }
  }

  private async handleLockFailure(
    job: Job<TelegramSearchJobData>,
    mode: TelegramScoutMode,
    reason: 'lock_busy' | 'lock_lost',
    startedAt: Date
  ) {
    if (reason === 'lock_lost') {
      await this.jobLogService
        .finish({
          companyId: job.data.companyId ?? null,
          queueName: QUEUES.TELEGRAM_SEARCH,
          jobName: job.name,
          bullJobId: job.id,
          status: 'PARTIAL',
          startedAt,
          result: { mode, reason: 'mtproto_lock_lost' }
        })
        .catch(() => null)
      return { ok: false, reason: 'mtproto_lock_lost' }
    }

    // lock_busy
    if (mode === 'watchlist') {
      // No self-requeue for watchlist — just push this channel's companies out a
      // couple minutes; the next dispatcher tick creates a fresh job (plan §1).
      if (job.data.telegramChannelId) {
        await this.prisma.companyTelegramChannel
          .updateMany({
            where: { telegramChannelId: job.data.telegramChannelId, enabled: true },
            data: { nextCheckAt: new Date(Date.now() + 2 * 60_000) }
          })
          .catch(() => null)
      }

      await this.jobLogService
        .finish({
          companyId: job.data.companyId ?? null,
          queueName: QUEUES.TELEGRAM_SEARCH,
          jobName: job.name,
          bullJobId: job.id,
          status: 'PARTIAL',
          startedAt,
          result: { mode, reason: 'mtproto_lock_busy' }
        })
        .catch(() => null)
      return { ok: false, reason: 'mtproto_lock_busy' }
    }

    // discovery / entity_search / source_check — self-requeue with a unique jobId.
    const retryCount = (job.data.lockRetryCount ?? 0) + 1
    const originalJobId = job.data.originalJobId ?? String(job.id)

    if (retryCount > lockMaxSelfRequeues()) {
      await this.jobLogService
        .finish({
          companyId: job.data.companyId ?? null,
          queueName: QUEUES.TELEGRAM_SEARCH,
          jobName: job.name,
          bullJobId: job.id,
          status: 'PARTIAL',
          startedAt,
          result: { mode, reason: 'mtproto_lock_busy_exhausted', retryCount }
        })
        .catch(() => null)
      return { ok: false, reason: 'mtproto_lock_busy_exhausted' }
    }

    const scheduledAtEpoch = Date.now()
    const newJobId = `${originalJobId}:lock-retry:${retryCount}:${scheduledAtEpoch}`

    await this.queue.add(
      job.name,
      { ...job.data, lockRetryCount: retryCount, originalJobId },
      { delay: lockRetryDelayMs(), jobId: newJobId }
    )

    await this.jobLogService
      .finish({
        companyId: job.data.companyId ?? null,
        queueName: QUEUES.TELEGRAM_SEARCH,
        jobName: job.name,
        bullJobId: job.id,
        status: 'PARTIAL',
        startedAt,
        result: { mode, reason: 'mtproto_lock_busy', requeuedAs: newJobId }
      })
      .catch(() => null)

    return { ok: false, reason: 'mtproto_lock_busy', requeuedAs: newJobId }
  }

  private computeStatus(mode: TelegramScoutMode, result: ModeResult): 'SUCCESS' | 'PARTIAL' {
    // Manual "add by username" (source_check + username) — a resolve failure is an
    // expected business outcome (bad username, private chat, etc.), not a system
    // problem, but it IS worth flagging as PARTIAL rather than a silent SUCCESS.
    if ('ok' in result) {
      return result.ok ? 'SUCCESS' : 'PARTIAL'
    }

    if (mode === 'discovery' || mode === 'entity_search') {
      const stats = result as TelegramScoutRunStats
      const partialReasons = ['flood_wait', 'max_runtime', 'max_messages', 'max_pages']
      return stats.stoppedReason && partialReasons.includes(stats.stoppedReason) ? 'PARTIAL' : 'SUCCESS'
    }

    // watchlist / source_check
    const watchlistResult = result as WatchlistProcessResult
    if (watchlistResult.errors.length > 0) return 'PARTIAL'
    if (watchlistResult.stoppedReason === 'flood_wait' || watchlistResult.stoppedReason === 'no_public_username') {
      return 'PARTIAL'
    }
    return 'SUCCESS'
  }
}
