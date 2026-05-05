import type { JobsOptions } from 'bullmq'

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
