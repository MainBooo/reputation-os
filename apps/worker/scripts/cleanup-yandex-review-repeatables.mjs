import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis({
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6380),
  maxRetriesPerRequest: null
})

const queue = new Queue('reviews_sync', { connection })

try {
  const repeatables = await queue.getRepeatableJobs()
  console.log(`reviews_sync repeatables before=${repeatables.length}`)

  for (const job of repeatables) {
    if (job.name === 'reviews.sync') {
      console.log('remove', { key: job.key, id: job.id, every: job.every, pattern: job.pattern })
      await queue.removeRepeatableByKey(job.key)
    }
  }

  const after = await queue.getRepeatableJobs()
  console.log(`reviews_sync repeatables after=${after.length}`)
} finally {
  await queue.close()
  await connection.quit()
}
