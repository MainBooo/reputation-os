import { Global, Module } from '@nestjs/common'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import { QUEUES } from './queue.names'

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null
})

const queueProviders = Object.values(QUEUES).map((name) => ({
  provide: `QUEUE_${name}` ,
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
