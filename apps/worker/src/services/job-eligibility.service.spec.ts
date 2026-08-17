import { JobEligibilityService } from './job-eligibility.service'

function buildFixture(overrides: Record<string, any> = {}) {
  const company = overrides.company ?? {
    id: 'company-1', workspaceId: 'workspace-1', isActive: true, workspace: { isActive: true }
  }
  const targets = overrides.targets ?? [
    { id: 'target-yandex', source: { platform: 'YANDEX', isEnabled: true } },
    { id: 'target-web', source: { platform: 'WEB', isEnabled: true } }
  ]
  const prisma: any = {
    subscription: { findUnique: jest.fn().mockResolvedValue(overrides.subscription ?? null) },
    featureOverride: { findMany: jest.fn().mockResolvedValue([]) },
    company: {
      findUnique: jest.fn().mockResolvedValue(company),
      findMany: jest.fn().mockResolvedValue([{ id: 'company-1' }])
    },
    companySourceTarget: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue({ id: 'target-web', isActive: false }),
      update: jest.fn().mockResolvedValue({ id: 'target-web', isActive: true }),
      findMany: jest.fn().mockImplementation((args: any) => {
        if (args.where?.companyId) return Promise.resolve(targets)
        return Promise.resolve([{ id: 'target-yandex' }, { id: 'target-web' }])
      })
    },
    watchedPage: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      upsert: jest.fn().mockResolvedValue({ id: 'page-1' })
    },
    source: { findMany: jest.fn().mockResolvedValue([]) },
    companyTelegramChannel: { findMany: jest.fn().mockResolvedValue([]) }
  }
  prisma.$executeRaw = jest.fn().mockResolvedValue(1)
  prisma.$transaction = jest.fn((action: (tx: any) => Promise<any>) => action(prisma))
  return { prisma, service: new JobEligibilityService(prisma) }
}

describe('JobEligibilityService — stale job server-side gate', () => {
  it('downgrades an expired paid subscription to FREE without deleting retained data', async () => {
    const expired = {
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() - 1000),
      plan: { code: 'PRO', limits: {} },
      scheduledPlan: null
    }
    const { prisma, service } = buildFixture({ subscription: expired })

    const eligible = await service.getEligibleTargets('company-1', 'mentions')

    expect(eligible.map((target: any) => target.id)).toEqual([])
    expect(prisma.company.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'company-1' } }))
    expect(prisma.company.delete).toBeUndefined()
    expect(prisma.companySourceTarget.delete).toBeUndefined()
  })

  it('keeps FREE-allowed Yandex review sync while blocking paid WEB monitoring after expiry', async () => {
    const expired = {
      status: 'ACTIVE', currentPeriodEnd: new Date(Date.now() - 1000),
      plan: { code: 'PRO', limits: {} }, scheduledPlan: null
    }
    const { service } = buildFixture({ subscription: expired })

    const reviews = await service.getEligibleTargets('company-1', 'reviews')
    const mentions = await service.getEligibleTargets('company-1', 'mentions')

    expect(reviews.map((target: any) => target.id)).toEqual(['target-yandex'])
    expect(mentions).toEqual([])
  })

  it.each([
    [{ id: 'company-1', workspaceId: 'workspace-1', isActive: false, workspace: { isActive: true } }, 'inactive company'],
    [{ id: 'company-1', workspaceId: 'workspace-1', isActive: true, workspace: { isActive: false } }, 'inactive workspace']
  ])('blocks %s before resolving targets (%s)', async (company) => {
    const { prisma, service } = buildFixture({ company })
    await expect(service.getEligibleTargets('company-1', 'reviews')).resolves.toEqual([])
    expect(prisma.companySourceTarget.findMany).not.toHaveBeenCalled()
  })

  it('requires active target, enabled source and the matching sync flag in the database query', async () => {
    const { prisma, service } = buildFixture()
    await service.getEligibleTargets('company-1', 'ratings')

    expect(prisma.companySourceTarget.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1', isActive: true, syncRatingsEnabled: true,
          source: { isEnabled: true }
        })
      })
    )
  })

  it('blocks a watched page whose target or source became inactive', async () => {
    const { prisma, service } = buildFixture()
    prisma.watchedPage.findUnique.mockResolvedValue({
      id: 'page-1', enabled: true, companyId: 'company-1',
      company: { workspaceId: 'workspace-1', isActive: true, workspace: { isActive: true } },
      sourceTarget: { id: 'target-web', isActive: false, source: { platform: 'WEB', isEnabled: true } }
    })
    await expect(service.canProcessWatchedPage('page-1')).resolves.toBeNull()
  })

  it('does not create a discovered source target after the locked maxSources count is exhausted', async () => {
    const { prisma, service } = buildFixture()
    prisma.companySourceTarget.count.mockResolvedValue(2)
    const create = jest.fn()

    await expect(
      service.runWithSourceSlot('workspace-1', 2, jest.fn().mockResolvedValue(null), create)
    ).resolves.toBeNull()

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1)
    expect(create).not.toHaveBeenCalled()
  })

  it('creates a discovered source target only after taking the shared workspace lock', async () => {
    const { prisma, service } = buildFixture()
    prisma.companySourceTarget.count.mockResolvedValue(1)
    const create = jest.fn().mockResolvedValue({ id: 'target-2' })

    await expect(
      service.runWithSourceSlot('workspace-1', 2, jest.fn().mockResolvedValue(null), create)
    ).resolves.toEqual({ id: 'target-2' })

    expect(prisma.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.companySourceTarget.count.mock.invocationCallOrder[0]
    )
    expect(prisma.companySourceTarget.count.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0]
    )
  })

  it('atomically blocks DeepScan promotion when maxWebPages is exhausted', async () => {
    const subscription = {
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 60_000),
      trialEndsAt: null,
      scheduledAt: null,
      scheduledPlan: null,
      plan: {
        code: 'PRO',
        limits: { webMonitoringEnabled: true, maxCompanies: 10, maxSources: 40, maxWebPages: 1 }
      }
    }
    const { prisma, service } = buildFixture({ subscription })
    prisma.watchedPage.count.mockResolvedValue(1)

    await expect(
      service.promoteWebTargetWithinLimits(
        'workspace-1', 'company-1', 'target-web', 'https://example.com/review', 'example.com', 1440
      )
    ).resolves.toBe(false)

    expect(prisma.companySourceTarget.update).not.toHaveBeenCalled()
    expect(prisma.watchedPage.upsert).not.toHaveBeenCalled()
  })

  it('promotes the target and watched page in one transaction when both slots are available', async () => {
    const subscription = {
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 60_000),
      trialEndsAt: null,
      scheduledAt: null,
      scheduledPlan: null,
      plan: {
        code: 'PRO',
        limits: { webMonitoringEnabled: true, maxCompanies: 10, maxSources: 40, maxWebPages: 50 }
      }
    }
    const { prisma, service } = buildFixture({ subscription })

    await expect(
      service.promoteWebTargetWithinLimits(
        'workspace-1', 'company-1', 'target-web', 'https://example.com/review', 'example.com', 1440
      )
    ).resolves.toBe(true)

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2)
    expect(prisma.companySourceTarget.update).toHaveBeenCalledWith({
      where: { id: 'target-web' }, data: { isActive: true }
    })
    expect(prisma.watchedPage.upsert).toHaveBeenCalledTimes(1)
  })
})
