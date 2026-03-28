const { Queue } = require('bullmq')
const IORedis = require('ioredis')

const connection = new IORedis('redis://127.0.0.1:6380', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

const QUEUES = [
  'source_discovery',
  'mentions_sync',
  'reviews_sync',
  'rating_refresh',
  'reconcile',
  'vk_brand_search_discovery',
  'vk_priority_communities_sync',
  'vk_owned_community_sync',
  'vk_comments_sync',
  'vk_brand_match',
  'vk_reconcile',
]

async function inspectQueue(name) {
  const queue = new Queue(name, { connection })

  const counts = await queue.getJobCounts()

  console.log(`\n=== QUEUE: ${name} ===`)
  console.log(counts)

  const jobs = await queue.getJobs(['waiting', 'active', 'completed', 'failed'], 0, 5)

  for (const job of jobs) {
    console.log({
      id: job.id,
      name: job.name,
      queue: name,
      attemptsMade: job.attemptsMade,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
      data: job.data,
    })
  }
}

async function main() {
  for (const q of QUEUES) {
    await inspectQueue(q)
  }

  await connection.quit()
}

main().catch(console.error)
