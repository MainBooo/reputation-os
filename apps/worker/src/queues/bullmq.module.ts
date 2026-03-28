import { Global, Module } from '@nestjs/common'
import IORedis from 'ioredis'
import { Queue } from 'bullmq'
import { QUEUES } from './queue.names'

const queueNames = Object.values(QUEUES)

@Global()
@Module({
  providers: [
    {
      provide: 'BULLMQ_CONNECTION',
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6380'

        return new IORedis(redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: false
        })
      }
    },
    ...queueNames.map((queueName) => ({
      provide: `QUEUE_${queueName}`,
      useFactory: (connection: IORedis) =>
        new Queue(queueName, {
          connection
        }),
      inject: ['BULLMQ_CONNECTION']
    }))
  ],
  exports: [
    'BULLMQ_CONNECTION',
    ...queueNames.map((queueName) => `QUEUE_${queueName}`)
  ]
})
export class BullmqModule {}
