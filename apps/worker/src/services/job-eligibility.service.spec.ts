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
      findMany: jest.fn().mockImplementation((args: any) => {
        if (args.where?.companyId) return Promise.resolve(targets)
        return Promise.resolve([{ id: 'target-yandex' }, { id: 'target-web' }])
      })
    },
    watchedPage: { findUnique: jest.fn(), findMany: jest.fn() },
    source: { findMany: jest.fn().mockResolvedValue([]) },
    companyTelegramChannel: { findMany: jest.fn().mockResolvedValue([]) }
  }
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
})
