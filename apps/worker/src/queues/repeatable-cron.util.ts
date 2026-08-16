import type { JobsOptions, Queue } from 'bullmq'

/**
 * Registers exactly one repeatable job under `jobId`/`everyMs`, first removing
 * any other repeatable registration for the same job name that doesn't match.
 *
 * Without this, a deploy that renames a cron's `jobId` or changes its interval
 * creates a brand-new BullMQ repeatable registration (the hash key includes
 * jobId/every) while the OLD one keeps ticking forever in Redis — nothing ever
 * calls `removeRepeatableByKey` for it. This happened for real: commit e446aae
 * renamed `telegram-watchlist-dispatcher:global` to `...:global:tick`, and the
 * pre-rename registration kept firing every 5 minutes indefinitely, duplicating
 * every dispatcher tick. Calling this on every boot makes the registration
 * self-healing instead of relying on someone remembering to clean up Redis.
 */
export async function ensureSingleRepeatableJob(
  queue: Queue,
  jobName: string,
  data: unknown,
  jobId: string,
  everyMs: number,
  options: JobsOptions,
  scopePrefix?: string
): Promise<void> {
  const existing = await queue.getRepeatableJobs()

  for (const job of existing) {
    if (job.name !== jobName) continue
    if (scopePrefix && !String(job.id || '').startsWith(scopePrefix) && !job.key.includes(scopePrefix)) continue
    if (job.id === jobId && Number(job.every) === everyMs) continue
    await queue.removeRepeatableByKey(job.key)
  }

  await queue.add(jobName, data, { ...options, repeat: { every: everyMs }, jobId })
}

/** Reconciles only repeatables owned by a known ReputationOS namespace. Jobs
 * from another producer sharing Redis are never touched. */
export async function reconcileKnownRepeatableJobs(
  queue: Queue,
  jobName: string,
  desired: Map<string, number>,
  knownIdPrefix: string
): Promise<number> {
  const existing = await queue.getRepeatableJobs()
  let removed = 0

  for (const job of existing) {
    if (job.name !== jobName) continue
    const id = String(job.id || '')
    if (!id.startsWith(knownIdPrefix) && !job.key.includes(knownIdPrefix)) continue

    const expectedEvery = desired.get(id)
    if (expectedEvery !== undefined && Number(job.every) === expectedEvery) continue

    await queue.removeRepeatableByKey(job.key)
    removed += 1
  }

  return removed
}

/** Removes every repeatable registration for `jobName` on `queue` — used where a
 *  cron is being retired (see telegram-watchlist-dispatcher.processor.ts): the
 *  canonical state is now "zero repeatables," so any leftover registration from
 *  before the retirement must be actively cleaned up, not just left unregistered. */
export async function removeAllRepeatableJobs(queue: Queue, jobName: string): Promise<number> {
  const existing = await queue.getRepeatableJobs()
  let removed = 0

  for (const job of existing) {
    if (job.name !== jobName) continue
    await queue.removeRepeatableByKey(job.key)
    removed += 1
  }

  return removed
}
