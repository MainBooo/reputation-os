import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'
import { VkCommentsService } from '../../services/vk/vk-comments.service'

@Injectable()
export class VkCommentsProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.VK_COMMENTS_SYNC}`) private readonly queue: Queue,
    private readonly service: VkCommentsService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.VK_COMMENTS_SYNC, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    return this.service.runForPost(job.data)
  }
}
