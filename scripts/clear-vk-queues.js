const { Queue } = require('bullmq')

const connection = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT || 6379),
  db: Number(process.env.REDIS_DB || 0),
  password: process.env.REDIS_PASSWORD || undefined
}

const queueNames = [
  'vk_brand_search_discovery',
  'vk_priority_communities_sync',
  'vk_owned_community_sync',
  'vk_reconcile'
]

async function clearQueue(name) {
  const queue = new Queue(name, { connection })

  console.log(`\n=== clearing queue: ${name} ===`)

  try {
    const repeatable = await queue.getRepeatableJobs()
    for (const job of repeatable) {
      console.log(`remove repeatable: ${job.key}`)
      await queue.removeRepeatableByKey(job.key)
    }

    await queue.clean(0, 10000, 'wait').catch(() => null)
    await queue.clean(0, 10000, 'active').catch(() => null)
    await queue.clean(0, 10000, 'delayed').catch(() => null)
    await queue.clean(0, 10000, 'completed').catch(() => null)
    await queue.clean(0, 10000, 'failed').catch(() => null)
    await queue.clean(0, 10000, 'paused').catch(() => null)

    await queue.obliterate({ force: true }).catch((error) => {
      console.log(`obliterate skipped for ${name}: ${error.message}`)
    })
  } finally {
    await queue.close()
  }
}

async function main() {
  for (const name of queueNames) {
    await clearQueue(name)
  }
  console.log('\nVK queues cleared')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
