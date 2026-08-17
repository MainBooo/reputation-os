import { Injectable, OnModuleDestroy, OnModuleInit, Inject } from '@nestjs/common'
import { Job, Queue, Worker } from 'bullmq'
import { PrismaService } from '../common/prisma/prisma.service'
import { QUEUES } from '../queues/queue.names'
import { WORKER_OPTIONS } from '../queues/job-options'
import { JobLogService } from '../services/job-log.service'

@Injectable()
export class ReconcileProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    @Inject(`QUEUE_${QUEUES.RECONCILE}`) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    private readonly jobLogService: JobLogService
  ) {}

  onModuleInit() {
    this.worker = new Worker(QUEUES.RECONCILE, async (job: Job) => this.handle(job), {
        connection: this.connection,
        ...WORKER_OPTIONS.reconcile
      })
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }

  async handle(job: Job<{ companyId?: string }>) {
    const companyId = job.data?.companyId
    try {
      if (!companyId) {
        await this.jobLogService.finish({
          queueName: QUEUES.RECONCILE,
          jobName: 'reconcile.run',
          bullJobId: job.id,
          status: 'CANCELLED',
          result: { skipped: true, reason: 'company_id_missing' }
        }).catch(() => null)
        return { skipped: true, reason: 'company_id_missing' }
      }
      const company = await (this.prisma as any).company.findUnique({
        where: { id: companyId },
        select: { isActive: true, workspace: { select: { isActive: true, deletedAt: true } } }
      })
      if (!company?.isActive || !company.workspace?.isActive || company.workspace?.deletedAt) {
        await this.jobLogService.finish({
          companyId,
          queueName: QUEUES.RECONCILE,
          jobName: 'reconcile.run',
          bullJobId: job.id,
          status: 'CANCELLED',
          result: { skipped: true, reason: 'company_inactive' }
        }).catch(() => null)
        return { skipped: true, reason: 'company_inactive' }
      }
      const duplicates = await this.prisma.mention.findMany({
        where: { companyId, duplicateOfId: null },
        orderBy: { createdAt: 'asc' }
      })

      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.RECONCILE,
        jobName: 'reconcile.run',
        bullJobId: job.id,
        status: 'SUCCESS',
        result: { checked: duplicates.length }
      }).catch(() => null)
      return { checked: duplicates.length }
    } catch (error) {
      await this.jobLogService.finish({
        companyId,
        queueName: QUEUES.RECONCILE,
        jobName: 'reconcile.run',
        bullJobId: job.id,
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : String(error)
      }).catch(() => null)
      throw error
    }
  }
}
