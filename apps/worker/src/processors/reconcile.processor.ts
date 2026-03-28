import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class ReconcileProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.RECONCILE}`) private readonly queue: Queue,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.RECONCILE, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(_job: Job) {
    const duplicates = await this.prisma.mention.findMany({
      where: { duplicateOfId: null },
      orderBy: { createdAt: 'asc' }
    })

    return { checked: duplicates.length }
  }
}
