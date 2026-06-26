import { Global, Module } from '@nestjs/common'
import IORedis from 'ioredis'
import { Queue } from 'bullmq'
import { QUEUES } from './queue.names'
import { DEFAULT_JOB_OPTIONS } from './job-options'

const queueNames = Object.values(QUEUES)

function createRedisConnection() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  })
}

@Global()
@Module({
  providers: [
    {
      provide: 'BULLMQ_CONNECTION',
      useFactory: () => createRedisConnection()
    },
    {
      provide: 'BULLMQ_WORKER_CONNECTION_FACTORY',
      useValue: () => createRedisConnection()
    },
    ...queueNames.map((queueName) => ({
      provide: `QUEUE_${queueName}`,
      useFactory: (connection: IORedis) =>
        new Queue(queueName, {
            connection,
            defaultJobOptions: DEFAULT_JOB_OPTIONS
          }),
      inject: ['BULLMQ_CONNECTION']
    }))
  ],
  exports: [
    'BULLMQ_CONNECTION',
    'BULLMQ_WORKER_CONNECTION_FACTORY',
    ...queueNames.map((queueName) => `QUEUE_${queueName}`)
  ]
})
export class BullmqModule {}
