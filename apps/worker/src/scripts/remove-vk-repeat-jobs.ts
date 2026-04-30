import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const connection = new IORedis('redis://127.0.0.1:6380', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const VK_QUEUE_NAMES = [
  'vk_brand_search_discovery',
  'vk_priority_communities_sync',
  'vk_owned_community_sync',
  'vk_post_search',
]

async function cleanupQueue(name: string) {
  const queue = new Queue(name, { connection })

  console.log(`\n=== VK QUEUE: ${name} ===`)

  const repeatableJobs = await queue.getRepeatableJobs()

  if (!repeatableJobs.length) {
    console.log('No repeatable jobs found')
    await queue.close()
    return
  }

  console.log(`Found repeatable jobs: ${repeatableJobs.length}`)

  for (const job of repeatableJobs) {
    console.log({
      queue: name,
      key: job.key,
      name: job.name,
      id: job.id,
      every: job.every,
      pattern: job.pattern,
      next: job.next,
    })
  }

  for (const job of repeatableJobs) {
    await queue.removeRepeatableByKey(job.key)
    console.log(`Removed repeatable job from ${name}: ${job.key}`)
  }

  const after = await queue.getRepeatableJobs()
  console.log(`Remaining repeatable jobs in ${name}: ${after.length}`)

  await queue.close()
}

async function main() {
  try {
    for (const queueName of VK_QUEUE_NAMES) {
      await cleanupQueue(queueName)
    }
  } finally {
    await connection.quit()
  }
}

main().catch((error) => {
  console.error('REMOVE_VK_REPEAT_JOBS_FAILED', error)
  process.exit(1)
})
