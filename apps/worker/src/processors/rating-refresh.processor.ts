import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { RatingService } from '../services/rating.service'
import { JobLogService } from '../services/job-log.service'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'

@Injectable()
export class RatingRefreshProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly ratingService: RatingService,
    private readonly jobLogService: JobLogService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.RATING_REFRESH, async (job: Job) => this.handle(job), {
      connection: this.connection,
      ...WORKER_OPTIONS.ratingRefresh
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data

    try {
      const targets = await this.prisma.companySourceTarget.findMany({
        where: { companyId, syncRatingsEnabled: true },
        include: { source: true }
      })

      let itemsDiscovered = 0
      let itemsCreated = 0
      let itemsDeduped = 0

      for (const target of targets) {
        const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
        const snapshot = await adapter.fetchRatingSnapshot(target)

        if (!snapshot) {
          itemsDeduped += 1
          continue
        }

        const ratingValue = Number(snapshot.ratingValue)

        if (!Number.isFinite(ratingValue)) {
          itemsDeduped += 1
          continue
        }

        await this.ratingService.persistSnapshot({
          companyId,
          sourceId: target.sourceId,
          companySourceTargetId: target.id,
          platform: target.source.platform,
          ratingValue,
          reviewsCount: Number.isFinite(Number(snapshot.reviewsCount)) ? Number(snapshot.reviewsCount) : null,
          capturedAt: snapshot.capturedAt ? new Date(snapshot.capturedAt) : new Date(),
          rawPayload: snapshot
        })

        itemsDiscovered += 1
        itemsCreated += 1
      }

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.RATING_REFRESH,
        jobName: 'rating.refresh',
        bullJobId: job.id,
        status: 'SUCCESS',
        itemsDiscovered,
        itemsCreated,
        itemsUpdated: 0,
        itemsDeduped,
        result: {
          processedTargets: targets.length
        }
      }).catch(() => null)

      return { companyId, processedTargets: targets.length, itemsDiscovered, itemsCreated, itemsDeduped }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.RATING_REFRESH,
        jobName: 'rating.refresh',
        bullJobId: job.id,
        status: 'FAILED',
        errorMessage: message
      }).catch(() => null)

      throw error
    }
  }
}
