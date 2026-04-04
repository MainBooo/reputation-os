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
    @Inject(`QUEUE_${QUEUES.VK_POST_SEARCH}`) private readonly vkPostSearchQueue: Queue
  ) {}

  async onModuleInit() {
    await this.scheduleAll().catch((error) => {
      this.logger.error(`scheduleAll failed: ${error?.message || error}`)
    })
  }

  async scheduleAll() {
    const prismaAny = this.prisma as any

    const companies = await prismaAny.company.findMany({
      where: { isActive: true }
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

      await this.reviewsSyncQueue.add(
        JOBS.REVIEWS_SYNC,
        { companyId: company.id },
        { repeat: { every: 6 * 60 * 60 * 1000 }, jobId: `reviews-sync:${company.id}` }
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

      await this.vkPostSearchQueue.add(
        'vk.post-search',
        { companyId: company.id },
        { repeat: { every: 8 * 60 * 60 * 1000 }, jobId: `vk-post-search:${company.id}` }
      ).catch(() => null)
    }

    this.logger.log('Scheduler initialized')
  }
}
