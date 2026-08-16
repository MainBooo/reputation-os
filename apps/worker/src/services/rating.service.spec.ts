import { RatingService } from './rating.service'

describe('RatingService — duplicate job idempotency', () => {
  it('upserts one daily snapshot per source target', async () => {
    const prisma: any = { ratingSnapshot: { upsert: jest.fn().mockResolvedValue({ id: 'snapshot-1' }) } }
    const service = new RatingService(prisma)
    const base = {
      companyId: 'company-1', sourceId: 'source-1', companySourceTargetId: 'target-1',
      platform: 'YANDEX' as any, ratingValue: 4.2, reviewsCount: 12
    }

    await service.persistSnapshot({ ...base, capturedAt: new Date('2026-08-16T10:00:00.000Z') })
    await service.persistSnapshot({ ...base, ratingValue: 4.3, capturedAt: new Date('2026-08-16T18:00:00.000Z') })

    expect(prisma.ratingSnapshot.upsert).toHaveBeenCalledTimes(2)
    expect(prisma.ratingSnapshot.upsert.mock.calls[0][0].where).toEqual({ dedupeKey: 'target-1:2026-08-16' })
    expect(prisma.ratingSnapshot.upsert.mock.calls[1][0].where).toEqual({ dedupeKey: 'target-1:2026-08-16' })
    expect(prisma.ratingSnapshot.upsert.mock.calls[1][0].update.ratingValue).toBe(4.3)
  })
})
