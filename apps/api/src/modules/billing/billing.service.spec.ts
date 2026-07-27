import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaymentStatus } from '@prisma/client'
import { BillingService, YookassaWebhookPayload } from './billing.service'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'

// Подавляем реальный createPaymentProvider — используем мок-провайдер.
// mockProviderName переключается между describe-блоками: 'MOCK' для
// существующих dev-flow тестов, 'YOOKASSA' для тестов верификации webhook
// против реального API (см. describe ниже) — provider.name читается один раз
// в конструкторе BillingService, поэтому значение фиксируется на момент compile().
let mockProviderName: 'MOCK' | 'YOOKASSA' = 'MOCK'
jest.mock('./billing.providers', () => ({
  createPaymentProvider: () => ({
    name: mockProviderName,
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

// Верификация против "реального" API ЮKassa (fetch замокан — реальных запросов
// и платежей нет). Покрывает P-01: тело webhook больше не может в одиночку
// активировать платный тариф, единственный источник истины — remote GET.
describe('BillingService — handleWebhook (YooKassa remote verification)', () => {
  let service: BillingService
  let fetchMock: jest.Mock

  const localPayment = {
    id: 'pay-1',
    workspaceId: 'ws-1',
    planCode: 'PRO',
    amount: 1890,
    currency: 'RUB',
    billingPeriod: 'monthly',
    provider: 'YOOKASSA',
    providerPaymentId: 'prov-real-1',
    status: PaymentStatus.PENDING,
  }

  function mockFetchResponse(status: number, body: unknown) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    })
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    mockProviderName = 'YOOKASSA'
    process.env.YOOKASSA_SHOP_ID = 'shop-test'
    process.env.YOOKASSA_SECRET_KEY = 'secret-test'

    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock

    mockPrisma.payment.findUnique.mockResolvedValue(localPayment)
    mockPrisma.plan.findUnique.mockResolvedValue({ id: 'plan-pro', code: 'PRO', name: 'PRO' })
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.$transaction.mockResolvedValue([])

    const module = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EntitlementsService, useValue: mockEntitlements },
      ],
    }).compile()
    service = module.get(BillingService)
  })

  afterAll(() => {
    mockProviderName = 'MOCK'
    delete process.env.YOOKASSA_SHOP_ID
    delete process.env.YOOKASSA_SECRET_KEY
  })

  it('activates the subscription when the provider confirms succeeded + matching amount/currency', async () => {
    mockFetchResponse(200, {
      id: 'prov-real-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '1890.00', currency: 'RUB' },
    })

    const result = await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })

    expect(result).toEqual({ ok: true })
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
    // workspaceId используется из ЛОКАЛЬНОЙ записи Payment, не из тела webhook —
    // подменить workspace через payload невозможно в принципе (id, а не metadata,
    // определяет, какая запись активируется).
    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws-1' } })
    )
  })

  it('rejects when provider reports the payment as still pending (forged payment.succeeded)', async () => {
    mockFetchResponse(200, { id: 'prov-real-1', status: 'pending', paid: false })

    await expect(
      service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })
    ).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects when the remote amount does not match the local payment amount', async () => {
    mockFetchResponse(200, {
      id: 'prov-real-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '1.00', currency: 'RUB' },
    })

    await expect(
      service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })
    ).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects when the remote currency does not match the local payment currency', async () => {
    mockFetchResponse(200, {
      id: 'prov-real-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '1890.00', currency: 'USD' },
    })

    await expect(
      service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })
    ).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('ignores webhook metadata entirely — activation is keyed only by providerPaymentId', async () => {
    mockFetchResponse(200, {
      id: 'prov-real-1',
      status: 'succeeded',
      paid: true,
      amount: { value: '1890.00', currency: 'RUB' },
    })

    // Атакующий подставляет чужой workspace/план в metadata тела запроса —
    // это поле нигде не читается кодом активации.
    await service.handleWebhook({
      event: 'payment.succeeded',
      object: { id: 'prov-real-1', status: 'succeeded', metadata: { workspaceId: 'ws-ATTACKER', planCode: 'AGENCY' } }
    })

    expect(mockPrisma.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'ws-1' },
        create: expect.objectContaining({ planId: 'plan-pro' }),
      })
    )
  })

  it('rejects when the YooKassa API call fails (non-2xx)', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })

    await expect(
      service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })
    ).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('rejects when the YooKassa API call times out / network fails', async () => {
    fetchMock.mockRejectedValue(new Error('The operation was aborted'))

    await expect(
      service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })
    ).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('does not call the provider a second time for an already-succeeded payment', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({ ...localPayment, status: PaymentStatus.SUCCEEDED })

    const result = await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })

    expect(result).toEqual({ ok: true, alreadyProcessed: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
