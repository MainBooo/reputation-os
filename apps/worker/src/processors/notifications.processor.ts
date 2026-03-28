import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class NotificationsProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.NOTIFICATIONS}`) private readonly queue: Queue
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.NOTIFICATIONS, async (job: Job) => this.handle(job), {
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
