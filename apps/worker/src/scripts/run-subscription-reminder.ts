import IORedis from 'ioredis'
import { Queue } from 'bullmq'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'

async function main() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: false })

  const queue = new Queue(QUEUES.SUBSCRIPTION_REMINDER, { connection })

  const job = await queue.add(JOBS.SUBSCRIPTION_REMINDER, { manual: true, source: 'debug-script' })

  console.log('SUBSCRIPTION_REMINDER_JOB_ADDED', { jobId: job.id })

  await queue.close()
  await connection.quit()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
