import { Test } from '@nestjs/testing'
import { MentionsService } from './mentions.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { AuditLogService } from '../admin/audit-log.service'

const mockPrisma = {
  company: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  mention: {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _avg: { ratingValue: null } }),
    update: jest.fn(),
    delete: jest.fn()
  },
  companySourceTarget: { findMany: jest.fn().mockResolvedValue([]) }
}

const mockAuditLog = {
  log: jest.fn().mockResolvedValue(undefined)
}

describe('MentionsService — findByCompany filters', () => {
  let service: MentionsService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'co-1', workspaceId: 'ws-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'OWNER', workspaceId: 'ws-1' })
    mockPrisma.mention.findMany.mockResolvedValue([])
    mockPrisma.mention.count.mockResolvedValue(0)
    mockPrisma.mention.aggregate.mockResolvedValue({ _avg: { ratingValue: null } })
    mockPrisma.companySourceTarget.findMany.mockResolvedValue([])

    const module = await Test.createTestingModule({
      providers: [
        MentionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog }
      ]
    }).compile()
    service = module.get(MentionsService)
  })

  it('defaults to hiding isInboxVisible:false mentions when includeHidden is not passed', async () => {
    await service.findByCompany('uid-1', 'co-1', {} as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.isInboxVisible).toBe(true)
  })

  it('returns hidden mentions when includeHidden=true', async () => {
    await service.findByCompany('uid-1', 'co-1', { includeHidden: 'true' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.isInboxVisible).toBeUndefined()
  })

  it('filters by messageClassification', async () => {
    await service.findByCompany('uid-1', 'co-1', { messageClassification: 'CUSTOMER_COMPLAINT' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.messageClassification).toBe('CUSTOMER_COMPLAINT')
  })

  it('filters by messageUrgency', async () => {
    await service.findByCompany('uid-1', 'co-1', { messageUrgency: 'HIGH' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.messageUrgency).toBe('HIGH')
  })

  it('filters by needsManualReview=true', async () => {
    await service.findByCompany('uid-1', 'co-1', { needsManualReview: 'true' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.needsManualReview).toBe(true)
  })

  it('filters by needsManualReview=false', async () => {
    await service.findByCompany('uid-1', 'co-1', { needsManualReview: 'false' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.needsManualReview).toBe(false)
  })

  it('defaults to needsManualReview:false when the param is omitted — pending-review items never leak into the main Inbox', async () => {
    await service.findByCompany('uid-1', 'co-1', {} as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.needsManualReview).toBe(false)
  })

  it('excludes IRRELEVANT-classified mentions from the default Inbox view', async () => {
    await service.findByCompany('uid-1', 'co-1', {} as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.AND).toEqual([{
      OR: [
        { messageClassification: null },
        { NOT: { messageClassification: 'IRRELEVANT' } },
        { reviewDecision: 'RELEVANT' }
      ]
    }])
  })

  it('a human-confirmed-relevant mention (reviewDecision=RELEVANT) is allowed back into the default Inbox despite messageClassification=IRRELEVANT', async () => {
    // The default-view AND clause ORs in reviewDecision=RELEVANT as an escape hatch;
    // Prisma (not this mock) evaluates it against real rows, so we assert the clause
    // that makes that possible is actually present in the query sent to Prisma.
    await service.findByCompany('uid-1', 'co-1', {} as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    const orClause = where.AND[0].OR
    expect(orClause).toContainEqual({ reviewDecision: 'RELEVANT' })
  })

  it('"На проверку" view (needsManualReview=true) is not additionally filtered by classification', async () => {
    await service.findByCompany('uid-1', 'co-1', { needsManualReview: 'true' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.needsManualReview).toBe(true)
    expect(where.AND).toBeUndefined()
  })

  it('"Не по теме" view (onlyIrrelevant=true) matches IRRELEVANT classification or a human IRRELEVANT decision, excludes pending review, and bypasses isInboxVisible', async () => {
    await service.findByCompany('uid-1', 'co-1', { onlyIrrelevant: 'true' } as any)

    const where = mockPrisma.mention.findMany.mock.calls[0][0].where
    expect(where.needsManualReview).toBe(false)
    expect(where.isInboxVisible).toBeUndefined()
    expect(where.AND).toEqual([{
      OR: [
        { messageClassification: 'IRRELEVANT' },
        { reviewDecision: 'IRRELEVANT' }
      ]
    }])
  })

  it('returns needsReviewCount and irrelevantCount in meta', async () => {
    mockPrisma.mention.count
      .mockResolvedValueOnce(0) // total
      .mockResolvedValueOnce(0) // ratedCount
      .mockResolvedValueOnce(7) // needsReviewCount
      .mockResolvedValueOnce(3) // irrelevantCount

    const result = await service.findByCompany('uid-1', 'co-1', {} as any)

    expect(result.meta.needsReviewCount).toBe(7)
    expect(result.meta.irrelevantCount).toBe(3)
  })
})

describe('MentionsService — resolveReview', () => {
  let service: MentionsService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'co-1', workspaceId: 'ws-1' })
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'OWNER', workspaceId: 'ws-1' })

    const module = await Test.createTestingModule({
      providers: [
        MentionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuditLogService, useValue: mockAuditLog }
      ]
    }).compile()
    service = module.get(MentionsService)
  })

  it('confirming relevant sets needsManualReview=false and reviewDecision=RELEVANT without touching the AI classification fields, and never deletes the mention', async () => {
    mockPrisma.mention.findUnique.mockResolvedValue({
      id: 'm-1',
      companyId: 'co-1',
      needsManualReview: true,
      reviewDecision: null,
      messageClassification: 'IRRELEVANT',
      messageClassConfidence: 0.3
    })
    mockPrisma.mention.update.mockResolvedValue({
      id: 'm-1',
      needsManualReview: false,
      reviewDecision: 'RELEVANT',
      messageClassification: 'IRRELEVANT'
    })

    const result = await service.resolveReview('uid-1', 'm-1', { decision: 'RELEVANT' } as any)

    const updateArgs = mockPrisma.mention.update.mock.calls[0][0]
    expect(updateArgs.data).toEqual({
      needsManualReview: false,
      reviewDecision: 'RELEVANT',
      reviewedAt: expect.any(Date),
      reviewedByUserId: 'uid-1'
    })
    expect(updateArgs.data.messageClassification).toBeUndefined()
    expect(result.reviewDecision).toBe('RELEVANT')
    expect(mockPrisma.mention.delete).not.toHaveBeenCalled()
    expect(mockAuditLog.log).toHaveBeenCalledWith(expect.objectContaining({
      action: 'mention.review_decision',
      entityType: 'Mention',
      entityId: 'm-1',
      actorUserId: 'uid-1'
    }))
  })

  it('marking not-relevant sets needsManualReview=false and reviewDecision=IRRELEVANT', async () => {
    mockPrisma.mention.findUnique.mockResolvedValue({
      id: 'm-2',
      companyId: 'co-1',
      needsManualReview: true,
      reviewDecision: null,
      messageClassification: 'CUSTOMER_QUESTION',
      messageClassConfidence: 0.4
    })
    mockPrisma.mention.update.mockResolvedValue({
      id: 'm-2',
      needsManualReview: false,
      reviewDecision: 'IRRELEVANT'
    })

    await service.resolveReview('uid-1', 'm-2', { decision: 'IRRELEVANT' } as any)

    const updateArgs = mockPrisma.mention.update.mock.calls[0][0]
    expect(updateArgs.data.needsManualReview).toBe(false)
    expect(updateArgs.data.reviewDecision).toBe('IRRELEVANT')
    expect(mockPrisma.mention.delete).not.toHaveBeenCalled()
  })
})
