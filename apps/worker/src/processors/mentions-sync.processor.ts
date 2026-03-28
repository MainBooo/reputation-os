import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { MentionService } from '../services/mention.service'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class MentionsSyncProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.MENTIONS_SYNC}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly mentionService: MentionService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.MENTIONS_SYNC, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data
    const targets = await this.prisma.companySourceTarget.findMany({
      where: { companyId, syncMentionsEnabled: true },
      include: { source: true }
    })

    for (const target of targets) {
      if (!['WEB', 'CUSTOM'].includes(target.source.platform)) continue
      const adapter = SourceAdapterFactory.getAdapter(target.source.platform)
      const mentions = await adapter.fetchMentions(target)
      for (const item of mentions) {
        await this.mentionService.persistExternalMention({
          companyId,
          sourceId: target.sourceId,
          platform: target.source.platform,
          type: target.source.platform === 'WEB' ? 'WEB_MENTION' : 'SOCIAL_MENTION',
          externalMentionId: item.externalMentionId,
          url: item.url,
          title: item.title,
          content: item.content,
          author: item.author,
          publishedAt: item.publishedAt,
          rawPayload: item,
          metadata: { syncType: 'mentions' }
        })
      }
    }

    return { companyId, processedTargets: targets.length }
  }
}
