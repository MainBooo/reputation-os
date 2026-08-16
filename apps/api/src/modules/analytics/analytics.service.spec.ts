import { ForbiddenException } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'

function buildFixture() {
  const prisma: any = {
    company: { findUnique: jest.fn().mockResolvedValue({ workspaceId: 'workspace-a' }) },
    user: { findUnique: jest.fn().mockResolvedValue({ systemRole: 'USER', isActive: true }) },
    workspaceMember: { findFirst: jest.fn().mockResolvedValue({ id: 'member-a' }) },
    mention: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      aggregate: jest.fn().mockResolvedValue({ _avg: { ratingValue: null } }),
      groupBy: jest.fn().mockResolvedValue([])
    },
    ratingSnapshot: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn().mockResolvedValue([])
  }
  const entitlements: any = { can: jest.fn().mockResolvedValue(true) }
  return { prisma, entitlements, service: new AnalyticsService(prisma, entitlements) }
}

describe('AnalyticsService — publication-time semantics', () => {
  it('filters current and comparison periods exclusively by publishedAt', async () => {
    const { prisma, service } = buildFixture()

    await service.overview('user-a', 'company-a', '2026-07-01', '2026-07-30')

    for (const call of prisma.mention.count.mock.calls) {
      expect(call[0].where.publishedAt).toEqual(expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }))
      expect(call[0].where.createdAt).toBeUndefined()
    }
    expect(prisma.mention.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { publishedAt: 'desc' } })
    )
  })

  it('does not count a historical review as today merely because it was ingested today', async () => {
    const { prisma, service } = buildFixture()
    await service.overview('user-a', 'company-a', '2026-08-16', '2026-08-16')

    const todayWhere = prisma.mention.count.mock.calls[0][0].where
    expect(todayWhere.publishedAt.gte.toISOString()).toBe('2026-08-16T00:00:00.000Z')
    expect(todayWhere.publishedAt.lte.toISOString()).toBe('2026-08-16T23:59:59.999Z')
    expect(todayWhere.createdAt).toBeUndefined()
  })

  it('builds reputation trend only from RatingSnapshot and returns an honest empty series otherwise', async () => {
    const { prisma, service } = buildFixture()
    const empty = await service.overview('user-a', 'company-a', '2026-08-01', '2026-08-02')
    expect(empty.reputationTrend).toEqual([])

    prisma.ratingSnapshot.findMany.mockResolvedValue([
      { capturedAt: new Date('2026-08-01T10:00:00.000Z'), ratingValue: 4.2 },
      { capturedAt: new Date('2026-08-01T18:00:00.000Z'), ratingValue: 4.4 }
    ])
    const withSnapshots = await service.overview('user-a', 'company-a', '2026-08-01', '2026-08-02')
    expect(withSnapshots.reputationTrend).toEqual([
      expect.objectContaining({ date: '2026-08-01', rating: 4.3 })
    ])
  })

  it('returns null KPI deltas when the previous period has no baseline', async () => {
    const { prisma, service } = buildFixture()
    prisma.mention.count
      .mockResolvedValueOnce(5).mockResolvedValueOnce(3).mockResolvedValueOnce(1).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4).mockResolvedValueOnce(0).mockResolvedValueOnce(0).mockResolvedValueOnce(0)
    const result = await service.overview('user-a', 'company-a', '2026-08-01', '2026-08-02')
    expect(result.deltas).toMatchObject({ total: null, positive: null, negative: null })
  })

  it('rejects cross-workspace analytics access before reading mention data', async () => {
    const { prisma, service } = buildFixture()
    prisma.workspaceMember.findFirst.mockResolvedValue(null)
    await expect(service.overview('user-b', 'company-a')).rejects.toThrow(ForbiddenException)
    expect(prisma.mention.count).not.toHaveBeenCalled()
  })
})
