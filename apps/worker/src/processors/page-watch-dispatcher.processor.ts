import { Injectable, OnModuleDestroy, OnModuleInit, Inject, Logger } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { CRON_JOB_OPTIONS } from '../queues/job-options'

// Redis key prefix for domain-level rate limiting
const DOMAIN_LOCK_PREFIX = 'pw:domain:'
const DOMAIN_LOCK_TTL_SEC = 10

@Injectable()
export class PageWatchDispatcherProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PageWatchDispatcherProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_WORKER_CONNECTION_FACTORY') private readonly workerConnectionFactory: () => any,
    @Inject('BULLMQ_CONNECTION') private readonly redis: any,
    @Inject(`QUEUE_${QUEUES.PAGE_WATCH}`) private readonly pageWatchQueue: Queue,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit() {
    const connection = this.workerConnectionFactory()
    this.worker = new Worker(
      QUEUES.PAGE_WATCH_DISPATCHER,
      async (job: Job) => this.handle(job),
      { connection, concurrency: 1, lockDuration: 4 * 60_000 }
    )
    this.worker.on('error', (err) => this.logger.error('Worker error', err))
    this.worker.on('failed', (_job, err) => this.logger.error(`Dispatcher job failed: ${err?.message}`))
    await this.worker.waitUntilReady()
    this.logger.log('PageWatchDispatcher worker READY')
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(_job: Job) {
    const now = new Date()

    // Find all enabled pages due for a check
    const pages = await (this.prisma as any).watchedPage.findMany({
      where: {
        enabled: true,
        OR: [
          { nextCheckAt: null },
          { nextCheckAt: { lte: now } }
        ]
      },
      select: { id: true, domain: true }
    })

    this.logger.log(`Dispatcher: found ${pages.length} pages due for check`)

    let dispatched = 0
    let throttled = 0

    for (const page of pages) {
      // Check domain rate limit — skip if another job for this domain is in flight
      const lockKey = `${DOMAIN_LOCK_PREFIX}${page.domain}`
      const locked = await this.redis.exists(lockKey)
      if (locked) {
        throttled++
        continue
      }

      // Add a one-shot job (no repeat); dedup by jobId so we never double-queue
      await this.pageWatchQueue.add(
        JOBS.PAGE_WATCH,
        { watchedPageId: page.id },
        {
          ...CRON_JOB_OPTIONS,
          jobId: `page-watch:once:${page.id}`,
          // Override attempts/backoff for one-shot dispatcher-driven jobs
          attempts: 1,
          removeOnComplete: { age: 60 * 5, count: 50 },
          removeOnFail: { age: 60 * 60 * 24, count: 50 }
        }
      ).catch((err: any) => {
        // "Job already exists" is fine — it's still queued
        if (!err?.message?.includes('already exists')) {
          this.logger.warn(`Failed to enqueue page ${page.id}: ${err?.message}`)
        }
      })

      dispatched++
    }

    this.logger.log(`Dispatcher: dispatched=${dispatched} throttled=${throttled}`)
  }

  // Called by SchedulerService to register the recurring cron job for this dispatcher
  async ensureCron(dispatcherQueue: Queue) {
    await dispatcherQueue.add(
      JOBS.PAGE_WATCH_DISPATCHER,
      { autoCron: true },
      {
        ...CRON_JOB_OPTIONS,
        repeat: { every: 5 * 60 * 1000 },
        jobId: 'page-watch-dispatcher:global'
      }
    )
  }
}
