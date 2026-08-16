import { Test } from '@nestjs/testing'
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common'
import { PaymentStatus, PlanCode, SubscriptionStatus, WorkspaceRole } from '@prisma/client'
import { BillingService } from './billing.service'
import { PrismaService } from '../../common/prisma/prisma.service'

let mockProviderName: 'MOCK' | 'YOOKASSA' = 'MOCK'
jest.mock('./billing.providers', () => ({
  createPaymentProvider: () => ({
    name: mockProviderName,
    createPayment: jest.fn().mockResolvedValue({ id: 'prov-1', confirmationUrl: 'https://pay.mock/1' })
  })
}))

const mockPrisma = {
  workspace: { findUnique: jest.fn() },
  workspaceMember: { findFirst: jest.fn() },
  subscription: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  plan: { findUnique: jest.fn(), findMany: jest.fn() },
  payment: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn()
  },
  $transaction: jest.fn()
}

const plan = {
  id: 'plan-pro', code: PlanCode.PRO, name: 'PRO', isActive: true,
  priceMonthly: 1890, priceYearly: 18_900
}
const pendingPayment = {
  id: 'pay-1', workspaceId: 'ws-1', userId: 'user-1', planCode: PlanCode.PRO,
  amount: 1890, currency: 'RUB', billingPeriod: 'monthly', provider: 'MOCK',
  providerPaymentId: 'prov-1', status: PaymentStatus.PENDING
}

async function buildService(provider: 'MOCK' | 'YOOKASSA' = 'MOCK') {
  mockProviderName = provider
  const module = await Test.createTestingModule({
    providers: [BillingService, { provide: PrismaService, useValue: mockPrisma }]
  }).compile()
  return module.get(BillingService)
}

function mockTransactionCallback() {
  mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(mockPrisma))
}

describe('BillingService — checkout workspace and permissions', () => {
  let service: BillingService

  beforeEach(async () => {
    jest.clearAllMocks()
    service = await buildService()
    mockPrisma.workspace.findUnique.mockResolvedValue({ id: 'ws-b', isActive: true })
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: WorkspaceRole.OWNER })
    mockPrisma.plan.findUnique.mockResolvedValue(plan)
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.payment.create.mockResolvedValue({ id: 'pay-b' })
    mockPrisma.payment.update.mockResolvedValue({})
  })

  it('bills the explicitly selected workspace when the user belongs to multiple workspaces', async () => {
    await service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')
    expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ws-b' } }))
    expect(mockPrisma.workspaceMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', workspaceId: 'ws-b' } })
    )
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: 'ws-b' }) })
    )
  })

  it('allows OWNER to manage billing', async () => {
    await expect(service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')).resolves.toMatchObject({ paymentId: 'pay-b' })
  })

  it.each([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER])('forbids %s from managing billing', async (role) => {
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role })
    await expect(service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')).rejects.toThrow(ForbiddenException)
    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
  })

  it('rejects a non-member of the selected workspace', async () => {
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null)
    await expect(service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')).rejects.toThrow(ForbiddenException)
  })

  it.each([null, 0])('rejects yearly checkout when priceYearly is %s', async (priceYearly) => {
    mockPrisma.plan.findUnique.mockResolvedValue({ ...plan, priceYearly })
    await expect(service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'yearly')).rejects.toThrow(BadRequestException)
    expect(mockPrisma.payment.create).not.toHaveBeenCalled()
  })

  it('uses the exact yearly price for yearly checkout', async () => {
    await service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'yearly')
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 18_900, billingPeriod: 'yearly' }) })
    )
  })

  it('uses priceMonthly for monthly checkout', async () => {
    await service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')
    expect(mockPrisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 1890, billingPeriod: 'monthly' }) })
    )
  })

  it('rejects a second pending checkout for the same workspace', async () => {
    const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/library')
    mockPrisma.payment.create.mockRejectedValue(new PrismaClientKnownRequestError('duplicate', { code: 'P2002', clientVersion: 'test' }))
    await expect(service.createCheckout('user-1', 'ws-b', PlanCode.PRO, 'monthly')).rejects.toThrow(ConflictException)
  })
})

describe('BillingService — webhook and subscription lifecycle', () => {
  let service: BillingService

  beforeEach(async () => {
    jest.clearAllMocks()
    service = await buildService()
    mockTransactionCallback()
    mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment)
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.plan.findUnique.mockResolvedValue(plan)
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.subscription.create.mockResolvedValue({})
    mockPrisma.subscription.update.mockResolvedValue({})
  })

  it('ignores events other than succeeded/canceled', async () => {
    await expect(service.handleWebhook({ event: 'payment.waiting_for_capture' })).resolves.toEqual({ ok: true, ignored: true })
  })

  it('rejects succeeded webhook without id or a local payment', async () => {
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: {} })).rejects.toThrow(BadRequestException)
    mockPrisma.payment.findUnique.mockResolvedValue(null)
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'unknown' } })).rejects.toThrow(NotFoundException)
  })

  it('activates the workspace recorded in Payment and ignores webhook metadata', async () => {
    await service.handleWebhook({
      event: 'payment.succeeded',
      object: { id: 'prov-1', metadata: { workspaceId: 'ws-attacker', planCode: 'AGENCY' } }
    })
    expect(mockPrisma.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workspaceId: 'ws-1', planId: 'plan-pro' }) })
    )
  })

  it('starts a full newly-paid period immediately for an upgrade', async () => {
    const oldEnd = new Date(Date.now() + 20 * 86_400_000)
    mockPrisma.subscription.findUnique.mockResolvedValue({
      workspaceId: 'ws-1', plan: { id: 'plan-start', code: PlanCode.START }, scheduledPlan: null,
      status: SubscriptionStatus.ACTIVE, currentPeriodStart: new Date(), currentPeriodEnd: oldEnd,
      billingPeriod: 'monthly', scheduledAt: null
    })
    await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-1' } })
    const data = mockPrisma.subscription.update.mock.calls[0][0].data
    expect(data.planId).toBe('plan-pro')
    expect(data.currentPeriodStart.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000)
    expect(data.currentPeriodEnd.getTime()).toBeLessThanOrEqual(Date.now() + 31 * 86_400_000)
  })

  it('schedules a downgrade at the current paid boundary', async () => {
    const switchAt = new Date(Date.now() + 20 * 86_400_000)
    mockPrisma.plan.findUnique.mockResolvedValue({ ...plan, id: 'plan-start', code: PlanCode.START })
    mockPrisma.payment.findUnique.mockResolvedValue({ ...pendingPayment, planCode: PlanCode.START })
    mockPrisma.subscription.findUnique.mockResolvedValue({
      workspaceId: 'ws-1', plan: { id: 'plan-pro', code: PlanCode.PRO }, scheduledPlan: null,
      status: SubscriptionStatus.ACTIVE, currentPeriodStart: new Date(), currentPeriodEnd: switchAt,
      billingPeriod: 'monthly', scheduledAt: null
    })
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-1' } })).resolves.toEqual({ ok: true, scheduled: true })
    const data = mockPrisma.subscription.update.mock.calls[0][0].data
    expect(data.planId).toBeUndefined()
    expect(data.scheduledPlanId).toBe('plan-start')
    expect(data.scheduledAt).toEqual(switchAt)
    expect(data.currentPeriodEnd.getTime()).toBe(switchAt.getTime() + 30 * 86_400_000)
  })

  it('extends the existing boundary for same-plan renewal', async () => {
    const oldEnd = new Date(Date.now() + 10 * 86_400_000)
    mockPrisma.subscription.findUnique.mockResolvedValue({
      workspaceId: 'ws-1', plan, scheduledPlan: null, status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(), currentPeriodEnd: oldEnd, billingPeriod: 'monthly', scheduledAt: null
    })
    await service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-1' } })
    expect(mockPrisma.subscription.update.mock.calls[0][0].data.currentPeriodEnd.getTime()).toBe(oldEnd.getTime() + 30 * 86_400_000)
  })

  it('is idempotent for already succeeded and concurrently claimed payments', async () => {
    mockPrisma.payment.findUnique.mockResolvedValue({ ...pendingPayment, status: PaymentStatus.SUCCEEDED })
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-1' } })).resolves.toEqual({ ok: true, alreadyProcessed: true })
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()

    mockPrisma.payment.findUnique.mockResolvedValue(pendingPayment)
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 0 })
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-1' } })).resolves.toEqual({ ok: true, alreadyProcessed: true })
    expect(mockPrisma.subscription.create).not.toHaveBeenCalled()
  })
})

describe('BillingService — YooKassa server-side verification', () => {
  let service: BillingService
  let fetchMock: jest.Mock
  const local = { ...pendingPayment, provider: 'YOOKASSA', providerPaymentId: 'prov-real-1' }

  function response(body: unknown, status = 200) {
    fetchMock.mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body })
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.YOOKASSA_SHOP_ID = 'shop-test'
    process.env.YOOKASSA_SECRET_KEY = 'secret-test'
    fetchMock = jest.fn()
    ;(global as any).fetch = fetchMock
    service = await buildService('YOOKASSA')
    mockTransactionCallback()
    mockPrisma.payment.findUnique.mockResolvedValue(local)
    mockPrisma.payment.updateMany.mockResolvedValue({ count: 1 })
    mockPrisma.plan.findUnique.mockResolvedValue(plan)
    mockPrisma.subscription.findUnique.mockResolvedValue(null)
    mockPrisma.subscription.create.mockResolvedValue({})
  })

  afterAll(() => {
    mockProviderName = 'MOCK'
    delete process.env.YOOKASSA_SHOP_ID
    delete process.env.YOOKASSA_SECRET_KEY
  })

  it('accepts only provider-confirmed success with exact amount and currency', async () => {
    response({ id: 'prov-real-1', status: 'succeeded', paid: true, amount: { value: '1890.00', currency: 'RUB' } })
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })).resolves.toEqual({ ok: true, scheduled: false })
  })

  it.each([
    [{ id: 'prov-real-1', status: 'pending', paid: false }, 'pending'],
    [{ id: 'prov-real-1', status: 'succeeded', paid: true }, 'missing amount'],
    [{ id: 'prov-real-1', status: 'succeeded', paid: true, amount: { value: '1.00', currency: 'RUB' } }, 'wrong amount'],
    [{ id: 'prov-real-1', status: 'succeeded', paid: true, amount: { value: '1890.00', currency: 'USD' } }, 'wrong currency']
  ])('rejects inconsistent provider state (%s: %s)', async (body, _caseName) => {
    response(body)
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })).rejects.toThrow(BadRequestException)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('fails closed on provider HTTP and network errors', async () => {
    response({}, 500)
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })).rejects.toThrow(BadRequestException)
    fetchMock.mockRejectedValue(new Error('network failed'))
    await expect(service.handleWebhook({ event: 'payment.succeeded', object: { id: 'prov-real-1' } })).rejects.toThrow(BadRequestException)
  })
})
