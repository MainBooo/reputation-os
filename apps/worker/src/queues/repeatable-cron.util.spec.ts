import { ensureSingleRepeatableJob, reconcileKnownRepeatableJobs } from './repeatable-cron.util'

function queueWith(jobs: any[]) {
  return {
    getRepeatableJobs: jest.fn().mockResolvedValue(jobs),
    removeRepeatableByKey: jest.fn().mockResolvedValue(true),
    add: jest.fn().mockResolvedValue({})
  } as any
}

describe('repeatable job reconciliation', () => {
  it('removes stale and old-interval jobs only inside the known ReputationOS namespace', async () => {
    const queue = queueWith([
      { name: 'reviews.sync', id: 'reviews-sync:deleted-company', every: 600_000, key: 'owned-stale' },
      { name: 'reviews.sync', id: 'reviews-sync:company-1', every: 300_000, key: 'owned-old-cron' },
      { name: 'reviews.sync', id: 'reviews-sync:company-2', every: 600_000, key: 'owned-valid' },
      { name: 'reviews.sync', id: 'another-product:company-1', every: 300_000, key: 'foreign' },
      { name: 'other.job', id: 'reviews-sync:foreign-name', every: 300_000, key: 'foreign-name' }
    ])
    const desired = new Map([['reviews-sync:company-1', 600_000], ['reviews-sync:company-2', 600_000]])

    await expect(reconcileKnownRepeatableJobs(queue, 'reviews.sync', desired, 'reviews-sync:')).resolves.toBe(2)
    expect(queue.removeRepeatableByKey.mock.calls.map((call: any[]) => call[0])).toEqual([
      'owned-stale', 'owned-old-cron'
    ])
  })

  it('scopes per-company Telegram replacement so one company never deletes another company cron', async () => {
    const queue = queueWith([
      { name: 'telegram.discovery', id: 'telegram-discovery:company-a:old', every: 300_000, key: 'company-a-old' },
      { name: 'telegram.discovery', id: 'telegram-discovery:company-b:cron', every: 86_400_000, key: 'company-b-valid' }
    ])

    await ensureSingleRepeatableJob(
      queue, 'telegram.discovery', { companyId: 'company-a' },
      'telegram-discovery:company-a:cron', 86_400_000, {}, 'telegram-discovery:company-a:'
    )

    expect(queue.removeRepeatableByKey).toHaveBeenCalledTimes(1)
    expect(queue.removeRepeatableByKey).toHaveBeenCalledWith('company-a-old')
    expect(queue.add).toHaveBeenCalledWith(
      'telegram.discovery', { companyId: 'company-a' },
      expect.objectContaining({ jobId: 'telegram-discovery:company-a:cron', repeat: { every: 86_400_000 } })
    )
  })
})
