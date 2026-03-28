import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { WorkerLogger } from '../common/logging/logger'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class SourceDiscoveryProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.SOURCE_DISCOVERY}`) private readonly queue: Queue,
    private readonly prisma: PrismaService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.SOURCE_DISCOVERY, async (job: Job) => this.handle(job), {
      connection: this.connection
    })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data
    const company = await this.prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return null

    const sources = await this.prisma.source.findMany({ where: { workspaceId: company.workspaceId } })
    for (const source of sources) {
      const adapter = SourceAdapterFactory.getAdapter(source.platform)
      const targets = await adapter.discoverTargets(company)
      for (const target of targets) {
        await this.prisma.companySourceTarget.create({
          data: {
            companyId,
            sourceId: source.id,
            externalPlaceId: target.externalPlaceId || null,
            externalUrl: target.externalUrl || null,
            displayName: target.displayName || null
          }
        }).catch(() => null)
      }
    }

    WorkerLogger.info('source discovery finished', { companyId })
    return { companyId }
  }
}
