import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { CRON_JOB_OPTIONS } from '../queues/job-options'
import { WORKER_OPTIONS } from '../queues/job-options'
import { watchlistDispatcherIntervalMin } from './telegram-scout/telegram-scout.config'

const DISPATCH_BATCH_LIMIT = 100

interface DueRow {
  id: string
  telegramChannelId: string
  checkIntervalMin: number
}

@Injectable()
export class TelegramWatchlistDispatcherProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramWatchlistDispatcherProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_WORKER_CONNECTION_FACTORY') private readonly workerConnectionFactory: () => any,
    @Inject(`QUEUE_${QUEUES.TELEGRAM_SEARCH}`) private readonly telegramSearchQueue: Queue,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const connection = this.workerConnectionFactory()
    this.worker = new Worker(QUEUES.TELEGRAM_WATCHLIST_DISPATCHER, async (job: Job) => this.handle(job), {
      connection,
      ...WORKER_OPTIONS.telegramWatchlistDispatcher
    })
    this.worker.on('error', (err) => this.logger.error(`Worker error: ${err?.message}`))
    await this.worker.waitUntilReady()
    this.logger.log('TelegramWatchlistDispatcher worker READY')
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(_job: Job) {
    const now = new Date()

    // FOR UPDATE SKIP LOCKED inside a short transaction is the only way to hand
    // out each due row to exactly one concurrent dispatcher — a plain
    // findMany+updateMany has a race window between the two statements under
    // READ COMMITTED that two dispatcher ticks (or two worker processes) could
    // both slip through.
    const due = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<DueRow[]>`
        SELECT id, "telegramChannelId", "checkIntervalMin"
        FROM "CompanyTelegramChannel"
        WHERE enabled = true AND "nextCheckAt" <= ${now}
        ORDER BY "nextCheckAt" ASC
        LIMIT ${DISPATCH_BATCH_LIMIT}
        FOR UPDATE SKIP LOCKED
      `

      if (rows.length === 0) return []

      for (const row of rows) {
        const nextCheckAt = new Date(now.getTime() + row.checkIntervalMin * 60_000)
        await tx.$executeRaw`
          UPDATE "CompanyTelegramChannel"
          SET "nextCheckAt" = ${nextCheckAt}
          WHERE id = ${row.id}
        `
      }

      return rows
    })

    if (due.length === 0) return { dispatched: 0, companiesDue: 0 }

    const scheduledAtEpoch = Date.now()
    const channelIds = new Set(due.map((row) => row.telegramChannelId))

    let dispatched = 0
    for (const telegramChannelId of channelIds) {
      const jobId = `telegram-watchlist:${telegramChannelId}:${scheduledAtEpoch}`

      await this.telegramSearchQueue
        .add(JOBS.TELEGRAM_WATCHLIST, { mode: 'watchlist', telegramChannelId }, { ...CRON_JOB_OPTIONS, attempts: 1, jobId })
        .then(() => {
          dispatched += 1
        })
        .catch((err: any) => {
          if (!err?.message?.includes('already exists')) {
            this.logger.warn(`Failed to enqueue telegram-watchlist for ${telegramChannelId}: ${err?.message}`)
          }
        })
    }

    this.logger.log(`Dispatcher: companiesDue=${due.length} channels=${channelIds.size} dispatched=${dispatched}`)
    return { dispatched, companiesDue: due.length }
  }

  // Called once at worker boot (see scheduler.service.ts) to register the recurring tick.
  async ensureCron(dispatcherQueue: Queue) {
    await dispatcherQueue.add(
      JOBS.TELEGRAM_WATCHLIST_DISPATCHER,
      { autoCron: true },
      {
        ...CRON_JOB_OPTIONS,
        repeat: { every: watchlistDispatcherIntervalMin() * 60_000 },
        jobId: 'telegram-watchlist-dispatcher:global:tick'
      }
    )
  }
}
