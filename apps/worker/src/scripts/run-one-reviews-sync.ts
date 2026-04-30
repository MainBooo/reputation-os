import { Queue } from 'bullmq'
import { QUEUES } from '../queues/queue.names'
import { JOBS } from '../queues/job.names'

async function main() {
  const companyId = process.argv[2]

  if (!companyId) {
    throw new Error('Usage: pnpm ts-node src/scripts/run-one-reviews-sync.ts <companyId>')
  }

  const queue = new Queue(QUEUES.REVIEWS_SYNC, {
    connection: {
      host: '127.0.0.1',
      port: 6380
    }
  })

  const job = await queue.add(JOBS.REVIEWS_SYNC, {
    companyId,
    manual: true,
    source: 'debug-script'
  })

  console.log('REVIEWS_SYNC_JOB_ADDED', { jobId: job.id, companyId })

  await queue.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
