import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { BillingService, YookassaWebhookPayload } from './billing.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'

// Подавляем реальный createPaymentProvider — используем мок-провайдер
jest.mock('./billing.providers', () => ({
  createPaymentProvider: () => ({
    name: 'MOCK',
    createPayment: jest.fn().mockResolvedValue({ id: 'prov-1', confirmationUrl: 'https://pay.mock/1' }),
  }),
}))

const mockPrisma = {
  workspaceMember: { findFirst: jest.fn() },
  subscription: { findUnique: jest.fn(), upsert: jest.fn() },
  plan: { findUnique: jest.fn(), findMany: jest.fn() },
  payment: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  $transaction: jest.fn(),
}

const mockEntitlements = {
  resolveWorkspaceId: jest.fn().mockResolvedValue('ws-1'),
  getForUser: jest.fn(),
  getForWorkspace: jest.fn(),
}

describe('BillingService — handleWebhook', () => {
  let service: BillingService

  beforeEach(async () => {
    jest.clearAllMocks()
    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: mockEntitlements },
      ],
    }).compile()
    service = module.get(BillingService)
  })

  it('ignores events other than payment.succeeded', async () => {
    const result = await service.handleWebhook({ event: 'payment.waiting_for_capture' })
    expect(result).toEqual({ ok: true, ignored: true })
    expect(mockPrisma.payment.findUnique).not.toHaveBeenCalled()
  })

  it('throws BadRequestException when object.id is missing', async () => {
    const payload: YookassaWebhookPayload = { event: 'payment.succeeded', object: {} }
    await expect(service.handleWebhook(payload)).rejects.toThrow(BadRequestException)
  })

  it('throws NotFoundException when payment not found by providerPaymentId', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue(null)
    const payload: YookassaWebhookPayload = { event: 'payment.succeeded', object: { id: 'prov-999' } }
    await expect(service.handleWebhook(payload)).rejects.toThrow(NotFoundException)
  })

  it('is idempotent — returns alreadyProcessed when payment already SUCCEEDED', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      workspaceId: 'ws-1',
      planCode: 'BASIC',
      status: PaymentStatus.SUCCEEDED,
      provider: 'MOCK',
    })

    const payload: YookassaWebhookPayload = { event: 'payment.succeeded', object: { id: 'prov-1' } }
    const result = await service.handleWebhook(payload)

    expect(result).toEqual({ ok: true, alreadyProcessed: true })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('activates subscription and updates payment on first success', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      workspaceId: 'ws-1',
      planCode: 'BASIC',
      status: PaymentStatus.PENDING,
      provider: 'MOCK',
    })
    mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan-1', code: 'BASIC', name: 'Basic' })
    mockPrisma.$transaction.mockResolvedValue([])

    const payload: YookassaWebhookPayload = { event: 'payment.succeeded', object: { id: 'prov-1' } }
    const result = await service.handleWebhook(payload)

    expect(result).toEqual({ ok: true })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
  })

  it('throws NotFoundException when plan not found after payment lookup', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1',
      workspaceId: 'ws-1',
      planCode: 'GHOST',
      status: PaymentStatus.PENDING,
      provider: 'MOCK',
    })
    mockPrisma.plan.findUnique.mockResolvedValue(null)

    const payload: YookassaWebhookPayload = { event: 'payment.succeeded', object: { id: 'prov-1' } }
    await expect(service.handleWebhook(payload)).rejects.toThrow(NotFoundException)
  })
})
