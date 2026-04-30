import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { Job, Worker } from 'bullmq'
import { AlertsService } from '../services/alerts.service'
import { QUEUES } from '../queues/queue.names'

@Injectable()
export class AlertsCheckProcessor implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker

  constructor(
    @Inject('BULLMQ_CONNECTION') private readonly connection: any,
    private readonly alertsService: AlertsService
  ) {}

  onModuleInit() {

    this.worker = new Worker(
      QUEUES.ALERT_CHECK,
      async (job: Job) => {
        return this.alertsService.checkAndSend()
      },
      { connection: this.connection }
    )
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close()
  }
}
