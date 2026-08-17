import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { WorkerLogger } from '../common/logging/logger'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'
import { JobEligibilityService } from '../services/job-eligibility.service'
import { JobLogService } from '../services/job-log.service'

@Injectable()
export class SourceDiscoveryProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.SOURCE_DISCOVERY}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly eligibility: JobEligibilityService,
    private readonly jobLogService: JobLogService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.SOURCE_DISCOVERY, async (job: Job) => this.handle(job), {
        connection: this.connection,
        ...WORKER_OPTIONS.sourceDiscovery
      })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job) {
    const { companyId } = job.data
    try {
      const { company, sources, maxSources } = await this.eligibility.getEligibleDiscoverySources(companyId)
      if (!company || !sources.length) {
        await this.jobLogService.finish({
          companyId,
          queueName: QUEUES.SOURCE_DISCOVERY,
          jobName: 'source.discovery',
          bullJobId: job.id,
          status: 'CANCELLED',
          result: { skipped: true, reason: 'not_eligible' }
        }).catch(() => null)
        return { companyId, skipped: true, reason: 'not_eligible' }
      }

      let itemsDiscovered = 0
      let itemsCreated = 0

      for (const source of sources) {
        const adapter = SourceAdapterFactory.getAdapter(source.platform)
        const targets = await adapter.discoverTargets(company)
        itemsDiscovered += targets.length

        for (const target of targets) {
          const externalPlaceId = target.externalPlaceId || null
          const externalUrl = target.externalUrl || null

          const result = await this.eligibility.runWithSourceSlot(
            company.workspaceId,
            maxSources ?? 0,
            async (tx) => {
              const existing = await tx.companySourceTarget.findFirst({
                where: {
                  companyId,
                  sourceId: source.id,
                  externalPlaceId,
                  externalUrl
                }
              })
              return existing ? { created: false } : null
            },
            async (tx) => {
              await tx.companySourceTarget.create({
                data: {
                  companyId,
                  sourceId: source.id,
                  externalPlaceId,
                  externalUrl,
                  displayName: target.displayName || null
                }
              })
              return { created: true }
            }
          )

          if (result?.created) itemsCreated += 1
        }
      }

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.SOURCE_DISCOVERY,
        jobName: 'source.discovery',
        bullJobId: job.id,
        status: 'SUCCESS',
        itemsDiscovered,
        itemsCreated
      }).catch(() => null)

      WorkerLogger.info('source discovery finished', { companyId, itemsDiscovered, itemsCreated })
      return { companyId, itemsDiscovered, itemsCreated }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.SOURCE_DISCOVERY,
        jobName: 'source.discovery',
        bullJobId: job.id,
        status: 'FAILED',
        errorMessage: message
      }).catch(() => null)
      throw error
    }
  }
}
