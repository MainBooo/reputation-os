import { Injectable, Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { VkTrackedCommunityMode } from '@prisma/client'
import { Job, Queue, Worker } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'
import { VkCommunitySyncService } from '../../services/vk/vk-community-sync.service'

@Injectable()
export class VkOwnedCommunityProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VkOwnedCommunityProcessor.name)
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.VK_OWNED_COMMUNITY_SYNC}`) private readonly queue: Queue,
    private readonly service: VkCommunitySyncService
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      this.queue.name,
      async (job: Job<any>) => {
        return this.service.processJob({
          ...job.data,
          mode: VkTrackedCommunityMode.OWNED_COMMUNITY
        })
      },
      {
        connection: this.connection
      }
    )

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `VkOwnedCommunityProcessor failed job ${job?.id || '-'}: ${String(error)}`,
        (error as any)?.stack
      )
    })
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
    }
  }
}
