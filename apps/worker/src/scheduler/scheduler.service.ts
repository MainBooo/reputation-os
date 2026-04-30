import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { Queue } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'

@Injectable()
export class SchedulerService implements OnModuleInit {
  private readonly logger = new Logger(SchedulerService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(`QUEUE_${QUEUES.SOURCE_DISCOVERY}`) private readonly sourceDiscoveryQueue: Queue,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly reviewsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly mentionsSyncQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly ratingRefreshQueue: Queue,
    @Inject(`QUEUE_${QUEUES.RECONCILE}`) private readonly reconcileQueue: Queue,
    @Inject(`QUEUE_${QUEUES.VK_POST_SEARCH}`) private readonly vkPostSearchQueue: Queue,
    @Inject(`QUEUE_${QUEUES.ALERT_CHECK}`) private readonly alertCheckQueue: Queue
  ) {}

  async onModuleInit() {
    await this.scheduleAll().catch((error) => {
      this.logger.error(`scheduleAll failed: ${error?.message || error}`)
    })
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

  async scheduleAll() {
    const prismaAny = this.prisma as any

    await this.alertCheckQueue.add(
      JOBS.ALERT_CHECK,
      { autoCron: true },
      {
        repeat: this.getAlertCheckRepeatOptions(),
        jobId: this.getAlertCheckRepeatJobId()
      }
    ).catch((error) => {
      this.logger.warn(`Failed to ensure alerts check cron: ${error?.message || error}`)
    })

    const companies = await prismaAny.company.findMany({
      where: { isActive: true }
    }).catch(() => [])

    const yandexTargets = await prismaAny.companySourceTarget.findMany({
      where: {
        isActive: true,
        syncReviewsEnabled: true,
        company: { isActive: true },
        source: {
          platform: 'YANDEX',
          isEnabled: true
        }
      },
      include: {
        company: true,
        source: true
      }
    }).catch(() => [])

    for (const company of companies) {
      if (!company?.id) {
        this.logger.log('Skipping scheduler company without id')
        continue
      }

      await this.sourceDiscoveryQueue.add(
        JOBS.SOURCE_DISCOVERY,
        { companyId: company.id },
        { repeat: { every: 12 * 60 * 60 * 1000 }, jobId: `source-discovery:${company.id}` }
      ).catch(() => null)

      await this.mentionsSyncQueue.add(
        JOBS.MENTIONS_SYNC,
        { companyId: company.id },
        { repeat: { every: 3 * 60 * 60 * 1000 }, jobId: `mentions-sync:${company.id}` }
      ).catch(() => null)

      await this.ratingRefreshQueue.add(
        JOBS.RATING_REFRESH,
        { companyId: company.id },
        { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `rating-refresh:${company.id}` }
      ).catch(() => null)

      await this.reconcileQueue.add(
        JOBS.RECONCILE,
        { companyId: company.id },
        { repeat: { every: 24 * 60 * 60 * 1000 }, jobId: `reconcile:${company.id}` }
      ).catch(() => null)

      // VK auto repeat disabled temporarily: manual запуска остаются через API/queue.
    }

    for (const target of yandexTargets) {
      const companyId = target?.companyId
      if (!companyId) continue

      await this.reviewsSyncQueue.add(
        JOBS.REVIEWS_SYNC,
        { companyId, autoCron: true },
        {
          repeat: this.getYandexReviewsRepeatOptions(),
          jobId: this.getYandexReviewsRepeatJobId(companyId)
        }
      ).catch((error) => {
        this.logger.warn(`Failed to ensure Yandex reviews cron companyId=${companyId}: ${error?.message || error}`)
      })
    }

    this.logger.log(`Scheduler initialized yandexReviewsCronTargets=${yandexTargets.length} alertCheckEveryMinutes=5`)
  }
}
