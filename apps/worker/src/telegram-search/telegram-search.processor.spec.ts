import { TelegramSearchProcessor } from './telegram-search.processor'
import { getTelegramSearchClient } from './client'
import { withTelegramMtprotoLock } from './mtproto-lock'

jest.mock('./client')
jest.mock('./mtproto-lock')

const mockedGetClient = getTelegramSearchClient as jest.Mock
const mockedWithLock = withTelegramMtprotoLock as jest.Mock

function fakeJob(overrides: Partial<{ id: string; name: string; data: any }> = {}) {
  return {
    id: overrides.id ?? 'job1',
    name: overrides.name ?? 'telegram.discovery',
    data: overrides.data ?? { mode: 'discovery', companyId: 'c1' }
  } as any
}

describe('TelegramSearchProcessor.handle', () => {
  let redis: any
  let queue: any
  let prisma: any
  let jobLogService: any
  let scoutService: any
  let watchlistService: any
  let processor: TelegramSearchProcessor

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.TELEGRAM_SCOUT_ENABLED = 'true'
    process.env.TELEGRAM_LOCK_MAX_SELF_REQUEUES = '5'
    process.env.TELEGRAM_LOCK_RETRY_DELAY_MS = '15000'

    redis = {}
    queue = { add: jest.fn().mockResolvedValue(undefined) }
    prisma = { companyTelegramChannel: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } }
    jobLogService = { finish: jest.fn().mockResolvedValue(undefined) }
    scoutService = { runDiscovery: jest.fn(), runEntitySearch: jest.fn() }
    watchlistService = { processChannel: jest.fn() }

    mockedGetClient.mockResolvedValue({ fakeClient: true })

    processor = new TelegramSearchProcessor(
      redis,
      () => ({}),
      queue,
      prisma,
      jobLogService,
      scoutService,
      watchlistService
    )
  })

  it('skips the job without touching Telegram when TELEGRAM_SCOUT_ENABLED is not true', async () => {
    process.env.TELEGRAM_SCOUT_ENABLED = 'false'
    const result = await processor.handle(fakeJob())

    expect(mockedGetClient).not.toHaveBeenCalled()
    expect(result).toEqual({ skipped: true, reason: 'telegram_scout_disabled' })
  })

  it('marks the job FAILED when the MTProto client fails to connect', async () => {
    mockedGetClient.mockRejectedValue(new Error('no session'))

    await expect(processor.handle(fakeJob())).rejects.toThrow('no session')

    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'no session' })
    )
  })

  it('reports SUCCESS for a clean discovery run and calls JobLogService.finish once', async () => {
    mockedWithLock.mockImplementation(async (_redis: any, _jobId: string, _mode: string, fn: any) => {
      const result = await fn({ assertHeld: () => {} })
      return { ok: true, result }
    })
    scoutService.runDiscovery.mockResolvedValue({
      mode: 'discovery',
      queriesExecuted: [],
      pagesFetched: 1,
      messagesScanned: 0,
      mentionsConfirmed: 0,
      mentionsRejected: 0,
      mentionsUnsure: 0,
      newChannelsFound: 0,
      newGroupsFound: 0,
      stoppedReason: 'exhausted'
    })

    await processor.handle(fakeJob())

    expect(jobLogService.finish).toHaveBeenCalledTimes(1)
    expect(jobLogService.finish).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUCCESS' }))
  })

  it('reports PARTIAL for a discovery run cut short by a budget', async () => {
    mockedWithLock.mockImplementation(async (_redis: any, _jobId: string, _mode: string, fn: any) => {
      const result = await fn({ assertHeld: () => {} })
      return { ok: true, result }
    })
    scoutService.runDiscovery.mockResolvedValue({
      mode: 'discovery',
      queriesExecuted: [],
      pagesFetched: 3,
      messagesScanned: 300,
      mentionsConfirmed: 2,
      mentionsRejected: 0,
      mentionsUnsure: 0,
      newChannelsFound: 0,
      newGroupsFound: 0,
      stoppedReason: 'max_messages'
    })

    await processor.handle(fakeJob())

    expect(jobLogService.finish).toHaveBeenCalledWith(expect.objectContaining({ status: 'PARTIAL' }))
  })

  it('reports PARTIAL for a watchlist run with per-company errors', async () => {
    mockedWithLock.mockImplementation(async (_redis: any, _jobId: string, _mode: string, fn: any) => {
      const result = await fn({ assertHeld: () => {} })
      return { ok: true, result }
    })
    watchlistService.processChannel.mockResolvedValue({
      telegramChannelId: 'tc1',
      companiesProcessed: 2,
      mentionsFound: 1,
      errors: [{ companyId: 'c-b', companyTelegramChannelId: 'ctb', message: 'boom' }],
      stoppedReason: 'ok'
    })

    await processor.handle(fakeJob({ name: 'telegram.watchlist', data: { mode: 'watchlist', telegramChannelId: 'tc1' } }))

    expect(jobLogService.finish).toHaveBeenCalledWith(expect.objectContaining({ status: 'PARTIAL' }))
  })

  describe('lock_busy', () => {
    it('watchlist: shifts nextCheckAt and does NOT self-requeue', async () => {
      mockedWithLock.mockResolvedValue({ ok: false, reason: 'lock_busy' })

      const result = await processor.handle(
        fakeJob({ name: 'telegram.watchlist', data: { mode: 'watchlist', telegramChannelId: 'tc1' } })
      )

      expect(queue.add).not.toHaveBeenCalled()
      expect(prisma.companyTelegramChannel.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { telegramChannelId: 'tc1', enabled: true } })
      )
      expect(result).toEqual({ ok: false, reason: 'mtproto_lock_busy' })
      expect(jobLogService.finish).toHaveBeenCalledWith(expect.objectContaining({ status: 'PARTIAL' }))
    })

    it('discovery: self-requeues with a unique jobId distinct from the original', async () => {
      mockedWithLock.mockResolvedValue({ ok: false, reason: 'lock_busy' })

      const job = fakeJob({ id: 'orig-job', name: 'telegram.discovery', data: { mode: 'discovery', companyId: 'c1' } })
      await processor.handle(job)

      expect(queue.add).toHaveBeenCalledTimes(1)
      const [jobName, jobData, options] = queue.add.mock.calls[0]
      expect(jobName).toBe('telegram.discovery')
      expect(jobData.lockRetryCount).toBe(1)
      expect(jobData.originalJobId).toBe('orig-job')
      expect(options.jobId).toMatch(/^orig-job:lock-retry:1:\d+$/)
      expect(options.jobId).not.toBe('orig-job')
      expect(options.delay).toBe(15000)
    })

    it('discovery: stops self-requeuing once TELEGRAM_LOCK_MAX_SELF_REQUEUES is exceeded', async () => {
      process.env.TELEGRAM_LOCK_MAX_SELF_REQUEUES = '2'
      mockedWithLock.mockResolvedValue({ ok: false, reason: 'lock_busy' })

      const job = fakeJob({
        id: 'orig-job',
        name: 'telegram.discovery',
        data: { mode: 'discovery', companyId: 'c1', lockRetryCount: 2, originalJobId: 'orig-job' }
      })
      const result = await processor.handle(job)

      expect(queue.add).not.toHaveBeenCalled()
      expect(result).toEqual({ ok: false, reason: 'mtproto_lock_busy_exhausted' })
    })

    it('successive retries produce distinct jobIds (no collision across retries)', async () => {
      mockedWithLock.mockResolvedValue({ ok: false, reason: 'lock_busy' })

      const job1 = fakeJob({ id: 'orig-job', data: { mode: 'discovery', companyId: 'c1' } })
      await processor.handle(job1)
      const firstRetryId = queue.add.mock.calls[0][2].jobId

      const job2 = fakeJob({
        id: 'orig-job',
        data: { mode: 'discovery', companyId: 'c1', lockRetryCount: 1, originalJobId: 'orig-job' }
      })
      await processor.handle(job2)
      const secondRetryId = queue.add.mock.calls[1][2].jobId

      expect(firstRetryId).not.toBe(secondRetryId)
    })
  })

  it('reports PARTIAL without throwing when the lock is lost mid-run', async () => {
    mockedWithLock.mockResolvedValue({ ok: false, reason: 'lock_lost' })

    const result = await processor.handle(fakeJob())

    expect(result).toEqual({ ok: false, reason: 'mtproto_lock_lost' })
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'PARTIAL', result: expect.objectContaining({ reason: 'mtproto_lock_lost' }) })
    )
  })
})
