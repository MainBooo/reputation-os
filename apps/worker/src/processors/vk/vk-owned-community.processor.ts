import { Injectable, OnModuleDestroy, OnModuleInit, Inject, Logger } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../../common/prisma/prisma.service'
import { QUEUES } from '../../queues/queue.names'
import { VkCommunityService } from '../../services/vk/vk-community.service'

@Injectable()
export class VkOwnedCommunityProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker
  private readonly logger = new Logger(VkOwnedCommunityProcessor.name)

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.VK_OWNED_COMMUNITY_SYNC}`) private readonly queue: Queue,
    private readonly service: VkCommunityService,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUES.VK_OWNED_COMMUNITY_SYNC,
      async (job: Job) => this.handle(job),
      { connection: this.connection }
    )
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const payload = {
      companyId: job.data?.companyId,
      sourceId: job.data?.sourceId,
      trackedCommunityId: job.data?.trackedCommunityId,
      communityId: job.data?.communityId
    }

    const result = await this.service.run(payload, job)

    await this.prisma.jobLog.create({
      data: {
        companyId: job.data?.companyId,
        queueName: QUEUES.VK_OWNED_COMMUNITY_SYNC,
        jobName: 'vk.owned-community',
        jobStatus: 'SUCCESS',
        result
      }
    }).catch(() => null)

    this.logger.log(`vk-owned-community finished for companyId=${job.data?.companyId}`)

    return result
  }
}
