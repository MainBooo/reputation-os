jest.mock('../adapters/source-adapter.factory')

import { ReviewsSyncProcessor } from './reviews-sync.processor'
import { SourceAdapterFactory } from '../adapters/source-adapter.factory'

function makeJob(companyId = 'company-1') {
  return { id: 'job-1', data: { companyId } } as any
}

function makeTarget(id: string, overrides: Partial<Record<string, any>> = {}) {
  return {
    id,
    sourceId: `src-${id}`,
    externalUrl: `https://example.com/${id}`,
    source: { platform: 'TWOGIS' },
    ...overrides
  }
}

describe('ReviewsSyncProcessor.handle — lastSyncedAt update semantics', () => {
  let prisma: any
  let mentionService: any
  let jobLogService: any
  let processor: ReviewsSyncProcessor

  beforeEach(() => {
    jest.clearAllMocks()

    prisma = {
      companySourceTarget: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({})
      },
      mention: { findMany: jest.fn().mockResolvedValue([]) },
      $executeRawUnsafe: jest.fn().mockResolvedValue(undefined)
    }
    mentionService = { persistExternalMention: jest.fn().mockResolvedValue({}) }
    jobLogService = { finish: jest.fn().mockResolvedValue({}) }

    processor = new ReviewsSyncProcessor({} as any, {} as any, prisma, mentionService, jobLogService)
  })

  it('updates lastSyncedAt for the correct target after a successful fetch (including zero mentions found)', async () => {
    const target = makeTarget('t1')
    prisma.companySourceTarget.findMany.mockResolvedValue([target])
    const adapter = { fetchMentions: jest.fn().mockResolvedValue([]) }
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue(adapter)

    await processor.handle(makeJob())

    expect(prisma.companySourceTarget.update).toHaveBeenCalledTimes(1)
    expect(prisma.companySourceTarget.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { lastSyncedAt: expect.any(Date) }
    })
  })

  it('does NOT update lastSyncedAt when fetchMentions throws (real sync failure, e.g. exhausted 2GIS retries)', async () => {
    const target = makeTarget('t1')
    prisma.companySourceTarget.findMany.mockResolvedValue([target])
    const adapter = { fetchMentions: jest.fn().mockRejectedValue(new Error('TWOGIS_NAVIGATION_FAILED: exhausted 2 attempts')) }
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue(adapter)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    await processor.handle(makeJob())

    expect(prisma.companySourceTarget.update).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalledWith('[REVIEWS] Target failed', expect.objectContaining({ targetId: 't1' }))
    warnSpy.mockRestore()
  })

  it('updates lastSyncedAt only for the target whose id matches — not some other target', async () => {
    const targetA = makeTarget('target-a')
    const targetB = makeTarget('target-b')
    prisma.companySourceTarget.findMany.mockResolvedValue([targetA, targetB])
    const adapter = { fetchMentions: jest.fn().mockResolvedValue([]) }
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue(adapter)

    await processor.handle(makeJob())

    expect(prisma.companySourceTarget.update).toHaveBeenNthCalledWith(1, { where: { id: 'target-a' }, data: { lastSyncedAt: expect.any(Date) } })
    expect(prisma.companySourceTarget.update).toHaveBeenNthCalledWith(2, { where: { id: 'target-b' }, data: { lastSyncedAt: expect.any(Date) } })
  })

  it('continues to the next target after one target fails, and still reports it in processedTargets', async () => {
    const targetA = makeTarget('target-a')
    const targetB = makeTarget('target-b')
    prisma.companySourceTarget.findMany.mockResolvedValue([targetA, targetB])
    const adapter = {
      fetchMentions: jest.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce([])
    }
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue(adapter)
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await processor.handle(makeJob())

    expect(prisma.companySourceTarget.update).toHaveBeenCalledTimes(1)
    expect(prisma.companySourceTarget.update).toHaveBeenCalledWith({ where: { id: 'target-b' }, data: { lastSyncedAt: expect.any(Date) } })
    expect(result.processedTargets).toBe(2)
  })

  it('logs a warning (never throws/crashes the job) when the lastSyncedAt update itself fails', async () => {
    const target = makeTarget('t1')
    prisma.companySourceTarget.findMany.mockResolvedValue([target])
    prisma.companySourceTarget.update.mockRejectedValue(new Error('connection pool exhausted'))
    const adapter = { fetchMentions: jest.fn().mockResolvedValue([]) }
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue(adapter)
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await processor.handle(makeJob())

    expect(result).toBeDefined()
    expect(warnSpy).toHaveBeenCalledWith(
      '[REVIEWS] Failed to update lastSyncedAt',
      expect.objectContaining({ targetId: 't1', platform: 'TWOGIS', error: 'connection pool exhausted' })
    )
    warnSpy.mockRestore()
  })
})
