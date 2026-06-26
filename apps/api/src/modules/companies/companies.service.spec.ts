import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { QUEUES } from '../../common/queues/queue.names'

const mockQueue = { add: jest.fn() }

const mockPrisma = {
  user: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  company: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  source: {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'src-1', platform: 'WEB', workspaceId: 'ws-1' }),
  },
  companySourceTarget: {
    create: jest.fn().mockResolvedValue({ id: 'cst-1' }),
    findFirst: jest.fn().mockResolvedValue(null),
  },
  companyAlias: { createMany: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
}

const mockEntitlements = {
  getForWorkspace: jest.fn().mockResolvedValue({ limits: { maxCompanies: -1 } }),
}

describe('CompaniesService — workspace access control', () => {
  let service: CompaniesService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        CompaniesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: mockEntitlements },
        { provide: `QUEUE_${QUEUES.REVIEWS_SYNC}`, useValue: mockQueue },
        { provide: `QUEUE_${QUEUES.RATING_REFRESH}`, useValue: mockQueue },
        { provide: `QUEUE_${QUEUES.MENTIONS_SYNC}`, useValue: mockQueue },
      ],
    }).compile()
    service = module.get(CompaniesService)
  })

  const dto = { workspaceId: 'ws-1', name: 'Acme', keywords: [] }

  it('throws ForbiddenException when user is not a workspace member', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null)

    await expect(service.create('uid-1', dto)).rejects.toThrow(ForbiddenException)
  })

  it('throws ForbiddenException when MEMBER tries to create a company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'MEMBER', workspaceId: 'ws-1' })

    await expect(service.create('uid-1', dto)).rejects.toThrow(ForbiddenException)
  })

  it('allows OWNER to create a company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'OWNER', workspaceId: 'ws-1' })
    mockPrisma.company.count.mockResolvedValue(0)
    mockPrisma.company.create.mockResolvedValue({ id: 'co-1', workspaceId: 'ws-1', name: 'Acme', normalizedName: 'acme' })
    mockPrisma.source.findFirst.mockResolvedValue(null)
    mockPrisma.companyAlias.createMany.mockResolvedValue({})
    mockPrisma.companyAlias.findMany.mockResolvedValue([])

    const result = await service.create('uid-1', dto)

    expect(result).toMatchObject({ id: 'co-1' })
  })

  it('allows ADMIN to create a company', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'ADMIN', workspaceId: 'ws-1' })
    mockPrisma.company.count.mockResolvedValue(0)
    mockPrisma.company.create.mockResolvedValue({ id: 'co-2', workspaceId: 'ws-1', name: 'Acme', normalizedName: 'acme' })
    mockPrisma.source.findFirst.mockResolvedValue(null)
    mockPrisma.companyAlias.createMany.mockResolvedValue({})
    mockPrisma.companyAlias.findMany.mockResolvedValue([])

    const result = await service.create('uid-2', dto)

    expect(result).toMatchObject({ id: 'co-2' })
  })
})
