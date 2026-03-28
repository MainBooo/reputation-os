import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { MentionService } from '../services/mention.service'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class ReviewsSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly mentionService: MentionService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.REVIEWS_SYNC, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data
    const targets = await this.prisma.companySourceTarget.findMany({
      where: { companyId, syncReviewsEnabled: true },
      include: { source: true }
    })

    for (const target of targets) {
      if (target.source.platform === 'VK') continue
      const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
      const mentions = await adapter.fetchMentions(target)
      for (const item of mentions) {
        await this.mentionService.persistExternalMention({
          companyId,
          sourceId: target.sourceId,
          platform: target.source.platform,
          type: 'REVIEW',
          externalMentionId: item.externalMentionId,
          url: item.url,
          title: item.title,
          content: item.content,
          author: item.author,
          publishedAt: item.publishedAt,
          ratingValue: item.ratingValue,
          rawPayload: item,
          metadata: { syncType: 'reviews' }
        })
      }
    }

    await this.prisma.jobLog.create({
      data: {
        companyId,
        queueName: QUEUES.REVIEWS_SYNC,
        jobName: 'reviews.sync',
        jobStatus: 'SUCCESS'
      }
    }).catch(() => null)

    return { companyId, processedTargets: targets.length }
  }
}
