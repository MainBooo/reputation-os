import { Test } from '@nestjs/testing'
import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { CompaniesService } from './companies.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from '../billing/entitlements.service'
import { QUEUES } from '../../common/queues/queue.names'

const mockQueue = { add: jest.fn() }

const mockPrisma = {
  user: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  company: { count: jest.fn(), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  source: {
    findFirst: jest.fn(),
    create: jest.fn().mockResolvedValue({ id: 'src-1', platform: 'WEB', workspaceId: 'ws-1' }),
  },
  companySourceTarget: {
    create: jest.fn().mockResolvedValue({ id: 'cst-1' }),
    findFirst: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
  },
  companyAlias: { createMany: jest.fn(), findMany: jest.fn(), deleteMany: jest.fn() },
}

const mockEntitlements = {
  getForWorkspace: jest.fn().mockResolvedValue({
    workspaceActive: true,
    limits: { maxCompanies: -1, maxSources: -1, platforms: ['YANDEX', 'TWOGIS'], webMonitoringEnabled: false },
  }),
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

describe('CompaniesService — deleteAlias tenant scoping (IDOR regression)', () => {
  let service: CompaniesService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'OWNER', workspaceId: 'ws-1' })
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'co-1', workspaceId: 'ws-1' })

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

  it('deletes the alias when it belongs to the requested company', async () => {
    mockPrisma.companyAlias.deleteMany.mockResolvedValue({ count: 1 })

    const result = await service.deleteAlias('uid-1', 'co-1', 'alias-1')

    expect(mockPrisma.companyAlias.deleteMany).toHaveBeenCalledWith({
      where: { id: 'alias-1', companyId: 'co-1' },
    })
    expect(result).toMatchObject({ id: 'alias-1' })
  })

  // Regression: deleteAlias used to call companyAlias.delete({where:{id: aliasId}})
  // — id alone is globally unique, so passing the aliasId of a DIFFERENT
  // company (in a different workspace the caller has no access to) still
  // matched and deleted it, because only the *company* (co-1) was checked
  // for workspace access, never whether the alias actually belongs to it.
  it('throws NotFoundException instead of deleting an alias that belongs to a different company', async () => {
    // deleteMany's own where clause (id + companyId) means a foreign alias
    // simply matches zero rows — this is what the fix relies on.
    mockPrisma.companyAlias.deleteMany.mockResolvedValue({ count: 0 })

    await expect(service.deleteAlias('uid-1', 'co-1', 'alias-from-another-company')).rejects.toThrow(
      NotFoundException,
    )
    expect(mockPrisma.companyAlias.deleteMany).toHaveBeenCalledWith({
      where: { id: 'alias-from-another-company', companyId: 'co-1' },
    })
  })
})

describe('CompaniesService — maxSources enforcement', () => {
  let service: CompaniesService

  beforeEach(async () => {
    jest.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ systemRole: 'USER', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: 'OWNER', workspaceId: 'ws-1' })
    mockPrisma.companyAlias.createMany.mockResolvedValue({})
    mockPrisma.companyAlias.findMany.mockResolvedValue([])

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

  // Regression: onboarding (create()) used to insert Yandex/2GIS/WEB CompanySourceTarget
  // rows directly via prisma, bypassing the maxSources check entirely — a workspace
  // already at its source limit could still accumulate more sources just by creating
  // new companies with yandexUrl/twoGisUrl set.
  it('creates the company but skips the Yandex source when maxSources is already exhausted', async () => {
    mockEntitlements.getForWorkspace.mockResolvedValue({
      workspaceActive: true,
      limits: { maxCompanies: -1, maxSources: 6, platforms: ['YANDEX', 'TWOGIS'], webMonitoringEnabled: false },
    })
    mockPrisma.companySourceTarget.count.mockResolvedValue(6) // already at the limit
    mockPrisma.company.count.mockResolvedValue(0)
    mockPrisma.company.create.mockResolvedValue({ id: 'co-3', workspaceId: 'ws-1' })
    mockPrisma.source.findFirst.mockResolvedValue({ id: 'src-yandex', platform: 'YANDEX' })

    const result = await service.create('uid-1', {
      workspaceId: 'ws-1',
      name: 'Acme',
      keywords: [],
      yandexUrl: 'https://yandex.ru/maps/org/acme/123',
    } as any)

    expect(result).toMatchObject({ id: 'co-3' })
    expect(mockPrisma.companySourceTarget.create).not.toHaveBeenCalled()
  })

  it('excludes TELEGRAM sources from the maxSources count', async () => {
    mockEntitlements.getForWorkspace.mockResolvedValue({
      workspaceActive: true,
      limits: { maxCompanies: -1, maxSources: 6, platforms: ['YANDEX'], webMonitoringEnabled: false },
    })
    mockPrisma.companySourceTarget.count.mockResolvedValue(0)
    mockPrisma.company.count.mockResolvedValue(0)
    mockPrisma.company.create.mockResolvedValue({ id: 'co-4', workspaceId: 'ws-1' })
    mockPrisma.source.findFirst.mockResolvedValue({ id: 'src-yandex', platform: 'YANDEX' })

    await service.create('uid-1', {
      workspaceId: 'ws-1',
      name: 'Acme',
      keywords: [],
      yandexUrl: 'https://yandex.ru/maps/org/acme/123',
    } as any)

    expect(mockPrisma.companySourceTarget.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: { platform: { not: 'TELEGRAM' } } }),
      }),
    )
  })

  // Regression: update() (PATCH /companies/:id, e.g. attaching a Yandex/2GIS url to an
  // existing company after the fact) created CompanySourceTarget rows directly too,
  // with zero maxSources check — the only gated path was the explicit "add source"
  // endpoint (createSourceTarget).
  it('rejects update() with PLAN_LIMIT when adding a new Yandex target past maxSources', async () => {
    mockEntitlements.getForWorkspace.mockResolvedValue({
      workspaceActive: true,
      limits: { maxCompanies: -1, maxSources: 3, platforms: ['YANDEX', 'TWOGIS'], webMonitoringEnabled: false },
    })
    mockPrisma.companySourceTarget.count.mockResolvedValue(3)
    mockPrisma.company.findUnique.mockResolvedValue({ id: 'co-5', workspaceId: 'ws-1' })
    mockPrisma.company.update.mockResolvedValue({ id: 'co-5', workspaceId: 'ws-1' })
    mockPrisma.source.findFirst.mockResolvedValue({ id: 'src-yandex', platform: 'YANDEX' })
    mockPrisma.companySourceTarget.findFirst.mockResolvedValue(null) // no existing target yet

    await expect(
      service.update('uid-1', 'co-5', { yandexUrl: 'https://yandex.ru/maps/org/acme/123' } as any),
    ).rejects.toMatchObject({ response: { code: 'PLAN_LIMIT', feature: 'maxSources', limit: 3 } })

    expect(mockPrisma.companySourceTarget.create).not.toHaveBeenCalled()
  })
})
