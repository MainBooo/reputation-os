import type { JobsOptions } from 'bullmq'

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 30_000
  },
  removeOnComplete: 1000,
  removeOnFail: 1000
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
  }
}
