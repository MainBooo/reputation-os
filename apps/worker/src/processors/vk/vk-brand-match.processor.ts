import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'

@Injectable()
export class VkBrandMatchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.VK_BRAND_MATCH}`) private readonly queue: Queue
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.VK_BRAND_MATCH, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    return { ok: true, payload: job.data }
  }
}
