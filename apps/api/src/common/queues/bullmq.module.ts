import { Global, Module } from '@nestjs/common'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { QUEUES } from './queue.names'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6380'

const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

const queueProviders = Object.values(QUEUES).map((name) => ({
  provide: `QUEUE_${name}`,
  useFactory: () => new Queue(name, { connection })
}))

@Global()
@Module({
  providers: [
    {
      provide: 'BULLMQ_CONNECTION',
      useFactory: () => connection
    },
    ...queueProviders
  ],
  exports: ['BULLMQ_CONNECTION', ...queueProviders.map((provider) => provider.provide)]
})
export class BullmqModule {}
