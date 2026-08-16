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

describe('EntitlementsService — scheduled plan boundary', () => {
  it('uses the scheduled plan limits after scheduledAt, not the old paid plan limits', async () => {
    const prisma: any = {
      subscription: { findUnique: jest.fn().mockResolvedValue({
        status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() + 10 * 86_400_000),
        currentPeriodStart: new Date(), billingPeriod: 'monthly', scheduledBillingPeriod: 'monthly',
        scheduledAt: new Date(Date.now() - 1000), trialEndsAt: null,
        plan: { code: 'PRO', name: 'PRO', priceMonthly: 1890, limits: { webMonitoringEnabled: true, maxCompanies: 10 } },
        scheduledPlan: { code: 'START', name: 'START', priceMonthly: 890, limits: { webMonitoringEnabled: false, maxCompanies: 3 } }
      }) },
      featureOverride: { findMany: jest.fn().mockResolvedValue([]) },
      company: { count: jest.fn().mockResolvedValue(4) },
      aIReplyDraft: { count: jest.fn().mockResolvedValue(0) },
      workspace: { findUnique: jest.fn().mockResolvedValue({ isActive: true }) },
      companySourceTarget: { count: jest.fn().mockResolvedValue(4) }
    }
    const service = new EntitlementsService(prisma)

    const result = await service.getForWorkspace('workspace-1')

    expect(result.planCode).toBe('START')
    expect(result.limits.webMonitoringEnabled).toBe(false)
    expect(result.limits.maxCompanies).toBe(3)
  })
})
