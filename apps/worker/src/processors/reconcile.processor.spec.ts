import { ReconcileProcessor } from './reconcile.processor'

describe('ReconcileProcessor JobLog lifecycle', () => {
  const job = { id: 'job-1', data: { companyId: 'company-1' } } as any
  let prisma: any
  let jobLogService: any
  let processor: ReconcileProcessor

  beforeEach(() => {
    prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          isActive: true,
          workspace: { isActive: true, deletedAt: null }
        })
      },
      mention: { findMany: jest.fn().mockResolvedValue([{ id: 'm1' }, { id: 'm2' }]) }
    }
    jobLogService = { finish: jest.fn().mockResolvedValue({}) }
    processor = new ReconcileProcessor({} as any, {} as any, prisma, jobLogService)
  })

  it('finishes a successful reconciliation log', async () => {
    await expect(processor.handle(job)).resolves.toEqual({ checked: 2 })
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        bullJobId: 'job-1',
        status: 'SUCCESS',
        result: { checked: 2 }
      })
    )
  })

  it('cancels stale jobs for inactive companies before reading mentions', async () => {
    prisma.company.findUnique.mockResolvedValue({
      isActive: true,
      workspace: { isActive: false, deletedAt: null }
    })

    await expect(processor.handle(job)).resolves.toMatchObject({ reason: 'company_inactive' })
    expect(prisma.mention.findMany).not.toHaveBeenCalled()
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'CANCELLED' })
    )
  })

  it('records failure and rethrows for BullMQ retry', async () => {
    prisma.mention.findMany.mockRejectedValue(new Error('database unavailable'))

    await expect(processor.handle(job)).rejects.toThrow('database unavailable')
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'database unavailable' })
    )
  })
})
