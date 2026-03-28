import { Global, Module } from '@nestjs/common'
import IORedis from 'ioredis'
import { Queue } from 'bullmq'
import { SyncController } from './sync.controller'
import { SyncService } from './sync.service'

@Global()
@Module({
  controllers: [SyncController],
  providers: [
    {
      provide: 'SYNC_BULLMQ_CONNECTION',
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6380'

        return new IORedis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false
        })
      }
    },
    {
      provide: 'SYNC_QUEUE_SOURCE_DISCOVERY',
      useFactory: (connection: IORedis) =>
        new Queue('source_discovery', { connection }),
      inject: ['SYNC_BULLMQ_CONNECTION']
    },
    {
      provide: 'SYNC_QUEUE_MENTIONS_SYNC',
      useFactory: (connection: IORedis) =>
        new Queue('mentions_sync', { connection }),
      inject: ['SYNC_BULLMQ_CONNECTION']
    },
    {
      provide: 'SYNC_QUEUE_REVIEWS_SYNC',
      useFactory: (connection: IORedis) =>
        new Queue('reviews_sync', { connection }),
      inject: ['SYNC_BULLMQ_CONNECTION']
    },
    {
      provide: 'SYNC_QUEUE_RATING_REFRESH',
      useFactory: (connection: IORedis) =>
        new Queue('rating_refresh', { connection }),
      inject: ['SYNC_BULLMQ_CONNECTION']
    },
    {
      provide: 'SYNC_QUEUE_RECONCILE',
      useFactory: (connection: IORedis) =>
        new Queue('reconcile', { connection }),
      inject: ['SYNC_BULLMQ_CONNECTION']
    },
    SyncService
  ],
  exports: [SyncService]
})
export class SyncModule {}
