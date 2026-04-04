import IORedis from 'ioredis'
import { Queue } from 'bullmq'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6380'
const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false
})

const legacyQueues = [
  'vk_brand_search_discovery',
  'vk_priority_communities_sync',
  'vk_owned_community_sync',
  'vk_comments_sync',
  'vk_brand_match',
  'vk_reconcile'
]

async function main() {
  for (const name of legacyQueues) {
    const queue = new Queue(name, { connection })

    const repeatables = await queue.getRepeatableJobs()
    for (const job of repeatables) {
      await queue.removeRepeatableByKey(job.key)
      console.log(`REMOVED_REPEATABLE ${name} ${job.key}`)
    }

    const waiting = await queue.getJobs(['waiting', 'delayed', 'prioritized', 'paused'], 0, 500)
    for (const job of waiting) {
      await job.remove().catch(() => null)
      console.log(`REMOVED_JOB ${name} ${job.id}`)
    }

    await queue.close()
  }

  await connection.quit()
}

main().catch(async (error) => {
  console.error(error)
  await connection.quit().catch(() => null)
  process.exit(1)
})
