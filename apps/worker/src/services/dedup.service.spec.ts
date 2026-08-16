import { Prisma } from '@prisma/client'
import { DedupService } from './dedup.service'

const base = {
  companyId: 'company-1', sourceId: 'source-1', platform: 'YANDEX' as any,
  type: 'REVIEW' as any, externalMentionId: 'review-1', content: 'Первоначальный текст',
  author: 'Автор', publishedAt: new Date('2025-01-01T00:00:00.000Z'), ratingValue: 3
}

describe('DedupService — repeated mention update and concurrency', () => {
  it('updates mutable review fields and publishedAt without creating a duplicate', async () => {
    const prisma: any = {
      mention: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mention-1', ...base, normalizedContent: 'первоначальный текст' }),
        update: jest.fn().mockResolvedValue({ id: 'mention-1' }),
        create: jest.fn()
      }
    }
    const service = new DedupService(prisma)
    const publishedAt = new Date('2025-02-02T00:00:00.000Z')

    await service.persistMention({ ...base, content: 'Исправленный текст', author: 'Новый автор', ratingValue: 5, publishedAt })

    expect(prisma.mention.create).not.toHaveBeenCalled()
    expect(prisma.mention.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'mention-1' },
      data: expect.objectContaining({ content: 'Исправленный текст', author: 'Новый автор', ratingValue: 5, publishedAt })
    }))
  })

  it('recovers from a concurrent unique-constraint race and updates the winner', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' })
    const prisma: any = {
      mention: {
        findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'winner', ...base, normalizedContent: 'первоначальный текст' }),
        create: jest.fn().mockRejectedValue(duplicate),
        update: jest.fn().mockResolvedValue({ id: 'winner' })
      }
    }
    const service = new DedupService(prisma)

    await expect(service.persistMention(base)).resolves.toEqual({ id: 'winner' })
    expect(prisma.mention.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'winner' } }))
  })
})
