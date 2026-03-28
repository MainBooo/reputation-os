import { Injectable, OnModuleDestroy, OnModuleInit, Inject, Logger } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { QUEUES } from '../../queues/queue.names'
import { VkBrandSearchService } from '../../services/vk/vk-brand-search.service'

@Injectable()
export class VkBrandSearchProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker
  private readonly logger = new Logger(VkBrandSearchProcessor.name)

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly service: VkBrandSearchService
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      QUEUES.VK_BRAND_SEARCH_DISCOVERY,
      async (job: Job) => {
        const companyId = job.data?.companyId as string | undefined
        const query = job.data?.query as string | undefined
        const searchProfileId = job.data?.searchProfileId as string | undefined

        if (!companyId) {
          this.logger.warn(`VkBrandSearchProcessor: skip job ${job.id} because companyId is missing`)
          return {
            skipped: true,
            reason: 'missing_company_id'
          }
        }

        return this.service.processJob({
          companyId,
          query,
          searchProfileId
        })
      },
      {
        connection: this.connection,
        concurrency: 3
      }
    )

    this.worker.on('completed', (job) => {
      this.logger.log(`VkBrandSearchProcessor completed job ${job.id}`)
    })

    this.worker.on('failed', (job, err) => {
      this.logger.error(`VkBrandSearchProcessor failed job ${job?.id}: ${err?.message}`, err?.stack)
    })
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
    }
  }
}
