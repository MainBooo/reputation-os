import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'
import { VkPostSearchService } from '../../services/vk/vk-post-search.service'

@Injectable()
export class VkPostSearchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker
  private readonly logger = new Logger(VkPostSearchProcessor.name)

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly service: VkPostSearchService
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUES.VK_POST_SEARCH,
      async (job: Job) => {
        const companyId = job.data?.companyId as string | undefined
        const triggeredByUserId = job.data?.triggeredByUserId as string | undefined

        if (!companyId) {
          return {
            ok: false,
            skipped: true,
            reason: 'missing_company_id'
          }
        }

        return this.service.processJob({
          companyId,
          triggeredByUserId
        })
      },
      {
        connection: this.connection,
        concurrency: 1
      }
    )

    this.worker.on('completed', (job) => {
      this.logger.log(`VkPostSearchProcessor completed job ${job.id}`)
    })

    this.worker.on('failed', (job, err) => {
      this.logger.error(`VkPostSearchProcessor failed job ${job?.id}: ${err?.message}`, err?.stack)
    })
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
    }
  }
}
