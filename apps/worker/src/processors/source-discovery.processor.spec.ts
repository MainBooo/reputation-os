jest.mock('../adapters/source-adapter.factory')

import { SourceAdapterFactory } from '../adapters/source-adapter.factory'
import { SourceDiscoveryProcessor } from './source-discovery.processor'

function makeJob() {
  return { id: 'job-1', data: { companyId: 'company-1' } } as any
}

describe('SourceDiscoveryProcessor JobLog lifecycle', () => {
  let eligibility: any
  let jobLogService: any
  let processor: SourceDiscoveryProcessor

  beforeEach(() => {
    jest.clearAllMocks()
    eligibility = {
      getEligibleDiscoverySources: jest.fn(),
      runWithSourceSlot: jest.fn()
    }
    jobLogService = { finish: jest.fn().mockResolvedValue({}) }
    processor = new SourceDiscoveryProcessor(
      {} as any,
      {} as any,
      {} as any,
      eligibility,
      jobLogService
    )
  })

  it('closes the pending log as CANCELLED when the stale job is no longer eligible', async () => {
    eligibility.getEligibleDiscoverySources.mockResolvedValue({ company: null, sources: [] })

    await expect(processor.handle(makeJob())).resolves.toMatchObject({
      skipped: true,
      reason: 'not_eligible'
    })
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: 'company-1',
        jobName: 'source.discovery',
        bullJobId: 'job-1',
        status: 'CANCELLED'
      })
    )
  })

  it('closes the pending log as SUCCESS and records discovery counters', async () => {
    eligibility.getEligibleDiscoverySources.mockResolvedValue({
      company: { id: 'company-1', workspaceId: 'workspace-1' },
      sources: [{ id: 'source-1', platform: 'WEB' }],
      maxSources: 5
    })
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue({
      discoverTargets: jest.fn().mockResolvedValue([
        { externalUrl: 'https://one.example', displayName: 'One' },
        { externalUrl: 'https://two.example', displayName: 'Two' }
      ])
    })
    eligibility.runWithSourceSlot
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false })

    await expect(processor.handle(makeJob())).resolves.toMatchObject({
      itemsDiscovered: 2,
      itemsCreated: 1
    })
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'SUCCESS',
        itemsDiscovered: 2,
        itemsCreated: 1
      })
    )
  })

  it('closes the pending log as FAILED and rethrows so BullMQ can retry', async () => {
    eligibility.getEligibleDiscoverySources.mockResolvedValue({
      company: { id: 'company-1', workspaceId: 'workspace-1' },
      sources: [{ id: 'source-1', platform: 'WEB' }],
      maxSources: 5
    })
    ;(SourceAdapterFactory.getAdapter as jest.Mock).mockReturnValue({
      discoverTargets: jest.fn().mockRejectedValue(new Error('provider unavailable'))
    })

    await expect(processor.handle(makeJob())).rejects.toThrow('provider unavailable')
    expect(jobLogService.finish).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'FAILED', errorMessage: 'provider unavailable' })
    )
  })
})
