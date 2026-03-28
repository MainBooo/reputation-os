import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { RatingService } from '../services/rating.service'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class RatingRefreshProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.RATING_REFRESH}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly ratingService: RatingService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.RATING_REFRESH, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data
    const targets = await this.prisma.companySourceTarget.findMany({
      where: { companyId, syncRatingsEnabled: true },
      include: { source: true }
    })

    for (const target of targets) {
      if (target.source.platform === 'VK') continue
      const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
      const snapshot = await adapter.fetchRatingSnapshot(target)
      if (!snapshot) continue

      await this.ratingService.persistSnapshot({
        companyId,
        sourceId: target.sourceId,
        companySourceTargetId: target.id,
        platform: target.source.platform,
        ratingValue: snapshot.ratingValue,
        reviewsCount: snapshot.reviewsCount,
        capturedAt: snapshot.capturedAt,
        rawPayload: snapshot
      })
    }

    return { companyId, processedTargets: targets.length }
  }
}
