import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'
import { CRON_JOB_OPTIONS } from '../queues/job-options'
import { ensureSingleRepeatableJob, reconcileKnownRepeatableJobs } from '../queues/repeatable-cron.util'
import { PageWatchDispatcherProcessor } from '../processors/page-watch-dispatcher.processor'
import { DeepScanProcessor } from '../processors/deep-scan.processor'
import { TelegramWatchlistDispatcherProcessor } from '../telegram-search/telegram-watchlist-dispatcher.processor'
import { JobEligibilityService } from '../services/job-eligibility.service'

const HEARTBEAT_KEY = 'worker:heartbeat'
const HEARTBEAT_TTL_SECONDS = 120
const HEARTBEAT_INTERVAL_MS = 60_000

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject('BULLMQ_CONNECTION') private readonly redis: any,
    @Inject(`QUEUE_${QUEUES.SOURCE_DISCOVERY}`) private readonly sourceDiscoveryQueue: Queue,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly reviewsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly mentionsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly ratingRefreshQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RECONCILE}`) private readonly reconcileQueue: Queue,
    @Inject(`QUEUE_${QUEUES.ALERT_CHECK}`) private readonly alertCheckQueue: Queue,
    @Inject(`QUEUE_${QUEUES.PAGE_WATCH}`) private readonly pageWatchQueue: Queue,
    @Inject(`QUEUE_${QUEUES.PAGE_WATCH_DISPATCHER}`) private readonly pageWatchDispatcherQueue: Queue,
    @Inject(`QUEUE_${QUEUES.SUBSCRIPTION_REMINDER}`) private readonly subscriptionReminderQueue: Queue,
    @Inject(`QUEUE_${QUEUES.DEEP_SCAN}`) private readonly deepScanQueue: Queue,
    @Inject(`QUEUE_${QUEUES.TELEGRAM_SEARCH}`) private readonly telegramSearchQueue: Queue,
    @Inject(`QUEUE_${QUEUES.TELEGRAM_WATCHLIST_DISPATCHER}`) private readonly telegramWatchlistDispatcherQueue: Queue,
    private readonly pageWatchDispatcher: PageWatchDispatcherProcessor,
    private readonly deepScan: DeepScanProcessor,
    private readonly telegramWatchlistDispatcher: TelegramWatchlistDispatcherProcessor,
    private readonly eligibility: JobEligibilityService
  ) {}

  private async writeHeartbeat() {
    await this.redis.set(HEARTBEAT_KEY, String(Date.now()), 'EX', HEARTBEAT_TTL_SECONDS)
  }

  async onModuleInit() {
    await this.scheduleAll().catch((error) => {
      this.logger.error(`scheduleAll failed: ${error?.message || error}`)
    })

    this.writeHeartbeat().catch(() => {})
    const interval = setInterval(() => { this.writeHeartbeat().catch(() => {}) }, HEARTBEAT_INTERVAL_MS)
    interval.unref()
  }

  private getYandexReviewsRepeatOptions() {
    return { every: 10 * 60 * 1000 }
  }

  private getYandexReviewsRepeatJobId(companyId: string) {
    return `reviews-sync:${companyId}`
  }

  private getAlertCheckRepeatOptions() {
    return { every: 5 * 60 * 1000 }
  }

  private getAlertCheckRepeatJobId() {
    return 'alerts-check:global'
  }

  private getWebMentionsRepeatJobId(companyId: string) {
    return `web-mentions-sync:${companyId}`
  }

  private normalizeWebScanIntervalMinutes(value: unknown) {
    const minutes = Number(value)

    if (minutes === 240 || minutes === 720 || minutes === 1440) {
      return minutes
    }

    return 1440
  }

  private getWebTargetIntervalMs(target: any) {
    const config = target?.config || {}
    const minutes = this.normalizeWebScanIntervalMinutes(
      config.scanIntervalMinutes || Number(config.scanIntervalHours || 24) * 60
    )

    return minutes * 60 * 1000
  }

  async scheduleAll() {
    const prismaAny = this.prisma as any

    await this.alertCheckQueue.add(
      JOBS.ALERT_CHECK,
      { autoCron: true },
      {
          ...CRON_JOB_OPTIONS,
          repeat: this.getAlertCheckRepeatOptions(),
          jobId: this.getAlertCheckRepeatJobId()
        }
    ).catch((error) => {
      this.logger.warn(`Failed to ensure alerts check cron: ${error?.message || error}`)
    })

    const companies = await prismaAny.company.findMany({
      where: { isActive: true, workspace: { isActive: true } }
    }).catch(() => [])

    const reviewTargets: any[] = []
    const webTargets: any[] = []
    const discoveryCompanyIds = new Set<string>()
    const ratingCompanyIds = new Set<string>()
    const telegramCompanyIds = new Set<string>()

    for (const company of companies) {
      const [reviews, web, ratings, discovery, telegramAllowed] = await Promise.all([
        this.eligibility.getEligibleTargets(company.id, 'reviews'),
        this.eligibility.getEligibleTargets(company.id, 'mentions'),
        this.eligibility.getEligibleTargets(company.id, 'ratings'),
        this.eligibility.getEligibleDiscoverySources(company.id),
        this.eligibility.canRunTelegramCompany(company.id)
      ])
      reviewTargets.push(...reviews)
      webTargets.push(...web.filter((target: any) => target.source?.platform === 'WEB'))
      if (discovery.sources.length) discoveryCompanyIds.add(company.id)
      if (ratings.length) ratingCompanyIds.add(company.id)

      if (telegramAllowed) {
        const telegramTarget = await prismaAny.companySourceTarget.findFirst({
          where: {
            companyId: company.id,
            isActive: true,
            syncMentionsEnabled: true,
            source: { platform: 'TELEGRAM', isEnabled: true }
          },
          select: { id: true }
        }).catch(() => null)
        if (telegramTarget) telegramCompanyIds.add(company.id)
      }
    }

    const webTargetsByCompany = new Map<string, any[]>()
    for (const target of webTargets) {
      if (!target?.companyId) continue
      const items = webTargetsByCompany.get(target.companyId) || []
      items.push(target)
      webTargetsByCompany.set(target.companyId, items)
    }

    const desiredReviews = new Map<string, number>()
    for (const target of reviewTargets) {
      if (target?.companyId) desiredReviews.set(this.getYandexReviewsRepeatJobId(target.companyId), this.getYandexReviewsRepeatOptions().every)
    }
    const desiredWeb = new Map<string, number>()
    for (const [companyId, targets] of webTargetsByCompany.entries()) {
      desiredWeb.set(
        this.getWebMentionsRepeatJobId(companyId),
        targets.map((target) => this.getWebTargetIntervalMs(target)).sort((a, b) => a - b)[0]
      )
    }
    const desiredDiscovery = new Map<string, number>([...discoveryCompanyIds].map((id) => [`source-discovery:${id}`, 12 * 60 * 60 * 1000]))
    const desiredRatings = new Map<string, number>([...ratingCompanyIds].map((id) => [`rating-refresh:${id}`, 24 * 60 * 60 * 1000]))
    const desiredReconcile = new Map<string, number>(companies.map((company: any) => [`reconcile:${company.id}`, 24 * 60 * 60 * 1000]))

    await Promise.all([
      reconcileKnownRepeatableJobs(this.reviewsSyncQueue, JOBS.REVIEWS_SYNC, desiredReviews, 'reviews-sync:'),
      reconcileKnownRepeatableJobs(this.mentionsSyncQueue, JOBS.MENTIONS_SYNC, desiredWeb, 'web-mentions-sync:'),
      reconcileKnownRepeatableJobs(this.sourceDiscoveryQueue, JOBS.SOURCE_DISCOVERY, desiredDiscovery, 'source-discovery:'),
      reconcileKnownRepeatableJobs(this.ratingRefreshQueue, JOBS.RATING_REFRESH, desiredRatings, 'rating-refresh:'),
      reconcileKnownRepeatableJobs(this.reconcileQueue, JOBS.RECONCILE, desiredReconcile, 'reconcile:')
    ]).catch((error) => this.logger.warn(`Repeatable reconciliation failed: ${error?.message || error}`))

    for (const company of companies) {
      if (!company?.id) {
        this.logger.log('Skipping scheduler company without id')
        continue
      }

      if (discoveryCompanyIds.has(company.id)) {
        await this.sourceDiscoveryQueue.add(
          JOBS.SOURCE_DISCOVERY,
          { companyId: company.id },
          { ...CRON_JOB_OPTIONS, repeat: { every: 12 * 60 * 60 * 1000 }, jobId: `source-discovery:${company.id}` }
        ).catch(() => null)
      }

      if (ratingCompanyIds.has(company.id)) {
        await this.ratingRefreshQueue.add(
          JOBS.RATING_REFRESH,
          { companyId: company.id },
          { ...CRON_JOB_OPTIONS, repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `rating-refresh:${company.id}` }
        ).catch(() => null)
      }

      await this.reconcileQueue.add(
        JOBS.RECONCILE,
        { companyId: company.id },
        { ...CRON_JOB_OPTIONS, repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `reconcile:${company.id}` }
      ).catch(() => null)
    }

    for (const [companyId, targets] of webTargetsByCompany.entries()) {
      const every = targets
        .map((target) => this.getWebTargetIntervalMs(target))
        .sort((a, b) => a - b)[0]

      await this.mentionsSyncQueue.add(
        JOBS.MENTIONS_SYNC,
        { companyId, autoCron: true, scope: 'WEB' },
        {
            ...CRON_JOB_OPTIONS,
            repeat: { every },
            jobId: this.getWebMentionsRepeatJobId(companyId)
          }
      ).catch((error) => {
        this.logger.warn(`Failed to ensure web mentions cron companyId=${companyId}: ${error?.message || error}`)
      })
    }

    for (const target of reviewTargets) {
      const companyId = target?.companyId
      if (!companyId) continue

      await this.reviewsSyncQueue.add(
        JOBS.REVIEWS_SYNC,
        { companyId, autoCron: true },
        {
            ...CRON_JOB_OPTIONS,
            repeat: this.getYandexReviewsRepeatOptions(),
            jobId: this.getYandexReviewsRepeatJobId(companyId)
          }
      ).catch((error) => {
        this.logger.warn(`Failed to ensure reviews cron companyId=${companyId}: ${error?.message || error}`)
      })
    }

    // Dispatcher pattern: one recurring job every 5 min finds due pages and dispatches individual jobs.
    // This allows new WatchedPages to be picked up without worker restart.
    await this.pageWatchDispatcher.ensureCron(this.pageWatchDispatcherQueue).catch((error) => {
      this.logger.warn(`Failed to ensure page-watch dispatcher cron: ${error?.message || error}`)
    })

    // Exactly one automatic Telegram Scout pass per company per day — global search
    // (name/domain/aliases) AND checking every already-enabled watchlist channel both
    // happen inside this single run (see TelegramScoutService.runDiscovery phase 4).
    // ensureSingleRepeatableJob self-heals: if a future deploy ever changes this
    // jobId or interval again, the stale registration is removed here instead of
    // ticking forever alongside the new one (see repeatable-cron.util.ts for why —
    // this exact bug already happened once, for the watchlist dispatcher below).
    const discoveryIntervalMs = Math.max(1, Number(process.env.TELEGRAM_SCOUT_DISCOVERY_INTERVAL_HOURS) || 24) * 60 * 60 * 1000
    const desiredTelegram = new Map(
      [...telegramCompanyIds].map((companyId) => [`telegram-discovery:${companyId}:cron`, discoveryIntervalMs])
    )
    await reconcileKnownRepeatableJobs(
      this.telegramSearchQueue,
      JOBS.TELEGRAM_DISCOVERY,
      desiredTelegram,
      'telegram-discovery:'
    ).catch((error) => {
      this.logger.warn(`Telegram repeatable reconciliation failed: ${error?.message || error}`)
    })

    for (const companyId of telegramCompanyIds) {
      await ensureSingleRepeatableJob(
        this.telegramSearchQueue,
        JOBS.TELEGRAM_DISCOVERY,
        { mode: 'discovery', companyId },
        `telegram-discovery:${companyId}:cron`,
        discoveryIntervalMs,
        CRON_JOB_OPTIONS,
        `telegram-discovery:${companyId}:`
      ).catch((error) => {
        this.logger.warn(`Failed to ensure telegram discovery cron companyId=${companyId}: ${error?.message || error}`)
      })
    }

    // Telegram watchlist: the standalone 5-15min dispatcher tick is retired (see
    // TelegramWatchlistDispatcherProcessor.disableCron) — per-channel checks now run
    // once/day inside the discovery job above. This call is what actually stops the
    // duplicate 5-min ticks already found running in Redis (two stale repeatable
    // registrations, one from before commit e446aae renamed the jobId).
    await this.telegramWatchlistDispatcher.disableCron(this.telegramWatchlistDispatcherQueue).catch((error) => {
      this.logger.warn(`Failed to disable telegram watchlist dispatcher cron: ${error?.message || error}`)
    })

    // Subscription reminder: daily check for trial/subscription expiry (3d, 1d, 0d before end)
    await this.subscriptionReminderQueue.add(
      JOBS.SUBSCRIPTION_REMINDER,
      { autoCron: true },
      {
        ...CRON_JOB_OPTIONS,
        repeat: { every: 24 * 60 * 60 * 1000 },
        jobId: 'subscription-reminder:daily'
      }
    ).catch((error) => {
      this.logger.warn(`Failed to ensure subscription reminder cron: ${error?.message || error}`)
    })

    // DeepScan: weekly promotion of already-discovered (mentions-sync/WebMentionAdapter)
    // WEB targets into continuous WatchedPage monitoring — no new search, no new filtering.
    await this.deepScan.ensureCron(this.deepScanQueue).catch((error) => {
      this.logger.warn(`Failed to ensure deep-scan cron: ${error?.message || error}`)
    })

    this.logger.log(
      `Scheduler initialized reviewCronTargets=${reviewTargets.length} webCronCompanies=${webTargetsByCompany.size} alertCheckEveryMinutes=5 pageWatchDispatcherEveryMinutes=5 subscriptionReminderEveryHours=24 deepScanEveryDays=7 telegramDiscoveryCompanies=${telegramCompanyIds.size}`
    )
  }
}
