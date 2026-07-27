import { Test } from '@nestjs/testing'
import { EntitlementsService } from './entitlements.service'
import { PrismaService } from '../../common/prisma/prisma.service'

const mockPrisma = {
  companySourceTarget: { count: jest.fn() }
}

describe('EntitlementsService — countBillableSources / hasSourceSlotAvailable', () => {
  let service: EntitlementsService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [EntitlementsService, { provide: PrismaService, useValue: mockPrisma }]
    }).compile()
    service = module.get(EntitlementsService)
  })

  // Regression: this exact where-clause used to be duplicated in CompaniesService,
  // SyncService and here — now there is exactly one place that decides TELEGRAM
  // doesn't count against maxSources (Scout is gated separately via
  // telegramMonitoringEnabled).
  it('excludes TELEGRAM sources from the count', async () => {
    mockPrisma.companySourceTarget.count.mockResolvedValue(3)

    const count = await service.countBillableSources('ws-1')

    expect(count).toBe(3)
    expect(mockPrisma.companySourceTarget.count).toHaveBeenCalledWith({
      where: {
        company: { workspaceId: 'ws-1' },
        isActive: true,
        source: { platform: { not: 'TELEGRAM' } }
      }
    })
  })

  it('hasSourceSlotAvailable treats a negative limit as unlimited', async () => {
    await expect(service.hasSourceSlotAvailable('ws-1', -1)).resolves.toBe(true)
    expect(mockPrisma.companySourceTarget.count).not.toHaveBeenCalled()
  })

  it('hasSourceSlotAvailable returns false once the count reaches the limit', async () => {
    mockPrisma.companySourceTarget.count.mockResolvedValue(6)
    await expect(service.hasSourceSlotAvailable('ws-1', 6)).resolves.toBe(false)
  })

  it('hasSourceSlotAvailable returns true while under the limit', async () => {
    mockPrisma.companySourceTarget.count.mockResolvedValue(5)
    await expect(service.hasSourceSlotAvailable('ws-1', 6)).resolves.toBe(true)
  })
})
