import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { MentionService } from '../services/mention.service'
import { JobLogService } from '../services/job-log.service'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'

@Injectable()
export class ReviewsSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.REVIEWS_SYNC}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly mentionService: MentionService,
    private readonly jobLogService: JobLogService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.REVIEWS_SYNC, async (job: Job) => this.handle(job), {
      connection: this.connection,
      ...WORKER_OPTIONS.reviewsSync
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data

    try {
      const targets = await this.prisma.companySourceTarget.findMany({
        where: { companyId, syncReviewsEnabled: true },
        include: { source: true }
      })

      let itemsDiscovered = 0
      let itemsCreated = 0
      let itemsUpdated = 0

      for (const target of targets) {
        let mentions: any[] = []

        try {
          const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
          mentions = await adapter.fetchMentions(target)

          const logoUrl = mentions
            .map((item: any) => item?.sourceMetadata?.logoUrl)
            .find((value: unknown) => typeof value === 'string' && value.trim().length > 0)

          if (logoUrl) {
            await this.prisma.$executeRawUnsafe(
              'update "Company" set "logoUrl" = $1 where "id" = $2 and "logoUrl" is null',
              String(logoUrl),
              companyId
            )

            console.log('[REVIEWS] Company logoUrl saved', {
              companyId,
              platform: target.source.platform,
              logoUrl
            })
          }
        } catch (targetError) {
          const targetMessage = targetError instanceof Error ? targetError.message : String(targetError)

          console.warn('[REVIEWS] Target failed', {
            targetId: target.id,
            platform: target.source.platform,
            externalUrl: target.externalUrl,
            error: targetMessage
          })

          continue
        }

        itemsDiscovered += mentions.length

        for (const item of mentions) {
          const existingMention = item.externalMentionId
            ? await this.prisma.mention.findFirst({
                where: {
                  companyId,
                  platform: target.source.platform,
                  externalMentionId: item.externalMentionId
                },
                select: { id: true }
              })
            : null

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
            metadata: { syncType: 'reviews' },
            companySourceTargetId: target.id
          })

          if (existingMention) {
            itemsUpdated += 1
          } else {
            itemsCreated += 1
          }
        }
      }

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.REVIEWS_SYNC,
        jobName: 'reviews.sync',
        bullJobId: job.id,
        status: 'SUCCESS',
        itemsDiscovered,
        itemsCreated,
        itemsUpdated,
        result: {
          processedTargets: targets.length
        }
      }).catch(() => null)

      return { companyId, processedTargets: targets.length, itemsDiscovered, itemsCreated, itemsUpdated }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.REVIEWS_SYNC,
        jobName: 'reviews.sync',
        bullJobId: job.id,
        status: 'FAILED',
        errorMessage: message
      }).catch(() => null)

      throw error
    }
  }
}
