import type { JobsOptions, WorkerOptions } from 'bullmq'

const ONE_DAY_SECONDS = 24 * 60 * 60
const SEVEN_DAYS_SECONDS = 7 * ONE_DAY_SECONDS

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 30_000
  },
  removeOnComplete: {
    age: ONE_DAY_SECONDS,
    count: 100
  },
  removeOnFail: {
    age: SEVEN_DAYS_SECONDS,
    count: 100
  }
}

export const SYNC_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 4,
  backoff: {
    type: 'exponential',
    delay: 60_000
  }
}

export const CRON_JOB_OPTIONS: JobsOptions = {
  ...DEFAULT_JOB_OPTIONS,
  attempts: 2,
  backoff: {
    type: 'fixed',
    delay: 120_000
  },
  removeOnComplete: {
    age: ONE_DAY_SECONDS,
    count: 50
  },
  removeOnFail: {
    age: SEVEN_DAYS_SECONDS,
    count: 50
  }
}

export const WORKER_OPTIONS = {
  reviewsSync: {
    concurrency: 1,
    lockDuration: 10 * 60_000
  },
  mentionsSync: {
    concurrency: 1,
    lockDuration: 5 * 60_000
  },
  ratingRefresh: {
    concurrency: 1,
    lockDuration: 3 * 60_000
  },
  sourceDiscovery: {
    concurrency: 1,
    lockDuration: 3 * 60_000
  },
  reconcile: {
    concurrency: 1,
    lockDuration: 3 * 60_000
  },
  alertCheck: {
    concurrency: 1,
    lockDuration: 60_000
  },
  notifications: {
    concurrency: 2,
    lockDuration: 60_000
  },
  pageWatch: {
    concurrency: 2,
    lockDuration: 2 * 60_000
  }
} satisfies Record<string, Partial<WorkerOptions>>
