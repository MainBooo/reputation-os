import { Test } from '@nestjs/testing'
import { MentionsService } from './mentions.service'
import { PrismaService } from '../../common/prisma/prisma.service'

const mockPrisma = {
  company: { findUnique: jest.fn() },
  user: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  mention: {
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({ _avg: { ratingValue: null } })
  },
  companySourceTarget: { findMany: jest.fn().mockResolvedValue([]) }
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
      providers: [MentionsService, { provide: PrismaService, useValue: mockPrisma }]
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
})
