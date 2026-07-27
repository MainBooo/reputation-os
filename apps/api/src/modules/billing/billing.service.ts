import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { BillingProvider, PaymentStatus, PlanCode, Prisma, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'
import { PaymentProvider, createPaymentProvider } from './billing.providers'

const PERIOD_DAYS_MONTHLY = 30
const PERIOD_DAYS_YEARLY = 365

export interface YookassaWebhookPayload {
  type?: string
  event?: string
  object?: {
    id?: string
    status?: string
    metadata?: Record<string, string>
  }
}

// Форма ответа GET /v3/payments/{id} из реального API ЮKassa — то немногое,
// что нам нужно для верификации. Это единственный источник истины: полю
// webhook.object.* не доверяем ни при каких обстоятельствах (см. handleWebhook).
interface YookassaRemotePayment {
  id: string
  status: string
  paid?: boolean
  amount?: { value: string; currency: string }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)
  private readonly provider: PaymentProvider = createPaymentProvider()

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService
  ) {}

  async createCheckout(userId: string, planCode: PlanCode, period: 'monthly' | 'yearly' = 'monthly') {
    const workspaceId = await this.entitlements.resolveWorkspaceId(userId)

    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })

    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found')
    if (plan.priceMonthly <= 0) throw new BadRequestException('Plan is free, no checkout required')

    const amount = period === 'yearly' && (plan as any).priceYearly
      ? (plan as any).priceYearly
      : plan.priceMonthly

    const payment = await this.prisma.payment.create({
      data: {
        workspaceId,
        userId,
        planCode,
        amount,
        billingPeriod: period,
        provider: this.provider.name === 'YOOKASSA' ? BillingProvider.YOOKASSA : BillingProvider.MOCK
      } as any
    })

    const returnUrl =
      process.env.YOOKASSA_RETURN_URL ||
      `${process.env.FRONTEND_URL || 'https://reputation.generationweb.ru'}/billing/payment-result`

    const periodLabel = period === 'yearly' ? 'годовая' : 'месячная'
    const providerPayment = await this.provider.createPayment({
      paymentId: payment.id,
      amount,
      description: `Подписка ${plan.name} (${periodLabel}) — ReputationOS`,
      metadata: { paymentId: payment.id, workspaceId, planCode },
      returnUrl
    })

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerPaymentId: providerPayment.id,
        confirmationUrl: providerPayment.confirmationUrl
      }
    })

    return { paymentId: payment.id, confirmationUrl: providerPayment.confirmationUrl }
  }

  // Webhook — это не более чем "подсказка перепроверить платёж X". Тело запроса
  // (status/amount/metadata) НИКОГДА не используется напрямую для активации —
  // оно приходит от неаутентифицированного HTTP-эндпоинта и легко подделывается
  // (сам providerPaymentId виден пользователю в confirmationUrl после чекаута).
  // Единственный источник истины — повторный server-to-server запрос к API
  // ЮKassa нашими собственными credentials (verifyPaymentWithProvider).
  async handleWebhook(payload: YookassaWebhookPayload) {
    const event = payload?.event
    this.logger.log(`Billing webhook received: ${event ?? 'unknown'}`)

    if (event !== 'payment.succeeded' && event !== 'payment.canceled') {
      return { ok: true, ignored: true }
    }

    const providerPaymentId = payload?.object?.id
    if (!providerPaymentId) throw new BadRequestException('object.id is required')

    const payment = await this.prisma.payment.findUnique({ where: { providerPaymentId } })
    if (!payment) throw new NotFoundException('Payment not found')

    if (event === 'payment.succeeded') {
      if (payment.status === PaymentStatus.SUCCEEDED) {
        this.logger.log(`payment.succeeded already processed: ${providerPaymentId}`)
        return { ok: true, alreadyProcessed: true }
      }
      return this.confirmAndActivate(payment)
    }

    if (payment.status === PaymentStatus.CANCELED) {
      this.logger.log(`payment.canceled already processed: ${providerPaymentId}`)
      return { ok: true, alreadyProcessed: true }
    }
    return this.confirmAndCancel(payment)
  }

  // Запрашивает состояние платежа напрямую у ЮKassa. MOCK-провайдер (dev/test,
  // не используется в проде — там BILLING_PROVIDER=yookassa) не имеет реального
  // API для перепроверки, поэтому для него подтверждением служит сам факт
  // локальной записи Payment — реальных денег там нет по определению.
  private async verifyPaymentWithProvider(providerPaymentId: string): Promise<YookassaRemotePayment> {
    if (this.provider.name !== 'YOOKASSA') {
      return { id: providerPaymentId, status: 'succeeded', paid: true }
    }

    const shopId = process.env.YOOKASSA_SHOP_ID
    const secretKey = process.env.YOOKASSA_SECRET_KEY

    if (!shopId || !secretKey) {
      this.logger.error('YooKassa credentials are not configured — cannot verify webhook payment')
      throw new BadRequestException('Payment verification is not configured')
    }

    const credentials = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

    let response: Response
    try {
      response = await fetch(`https://api.yookassa.ru/v3/payments/${providerPaymentId}`, {
        headers: { Authorization: `Basic ${credentials}` },
        signal: AbortSignal.timeout(8000)
      })
    } catch (err) {
      this.logger.error(`YooKassa payment verification request failed: ${(err as Error).message}`)
      throw new BadRequestException('Payment verification request failed')
    }

    if (!response.ok) {
      this.logger.warn(`YooKassa payment verification returned HTTP ${response.status} for ${providerPaymentId}`)
      throw new BadRequestException('Payment verification failed')
    }

    const data = (await response.json()) as YookassaRemotePayment
    if (!data?.id || data.id !== providerPaymentId) {
      this.logger.warn(`YooKassa payment verification id mismatch for ${providerPaymentId}`)
      throw new BadRequestException('Payment verification mismatch')
    }

    return data
  }

  private assertAmountMatches(payment: { amount: number; currency: string }, remote: YookassaRemotePayment) {
    if (!remote.amount) return // MOCK provider / no amount reported — nothing to cross-check

    const remoteValue = Number(remote.amount.value)
    const expected = Number(payment.amount)

    if (!Number.isFinite(remoteValue) || Math.abs(remoteValue - expected) > 0.01) {
      this.logger.warn(`Payment amount mismatch: expected=${expected} remote=${remote.amount.value}`)
      throw new BadRequestException('Payment amount mismatch')
    }

    if (remote.amount.currency && remote.amount.currency !== payment.currency) {
      this.logger.warn(`Payment currency mismatch: expected=${payment.currency} remote=${remote.amount.currency}`)
      throw new BadRequestException('Payment currency mismatch')
    }
  }

  private async confirmAndActivate(payment: Awaited<ReturnType<typeof this.prisma.payment.findUnique>> & Record<string, any>) {
    const providerPaymentId = payment.providerPaymentId as string
    const remote = await this.verifyPaymentWithProvider(providerPaymentId)

    if (remote.status !== 'succeeded' || remote.paid === false) {
      this.logger.warn(
        `Webhook claimed payment.succeeded but provider reports status=${remote.status} paid=${remote.paid} for ${providerPaymentId} — not activating`
      )
      throw new BadRequestException('Payment is not confirmed as succeeded by the provider')
    }

    this.assertAmountMatches(payment, remote)

    const plan = await this.prisma.plan.findUnique({ where: { code: payment.planCode } })
    if (!plan) throw new NotFoundException('Plan not found')

    const now = new Date()
    const periodDays = (payment as any).billingPeriod === 'yearly' ? PERIOD_DAYS_YEARLY : PERIOD_DAYS_MONTHLY
    const periodMs = periodDays * 24 * 60 * 60 * 1000

    // Если подписка уже активна — продлеваем от текущего конца периода, иначе от now
    const existingSub = await this.prisma.subscription.findUnique({
      where: { workspaceId: payment.workspaceId },
      select: { currentPeriodEnd: true, status: true }
    })

    const isCurrentlyActive =
      existingSub?.status === SubscriptionStatus.ACTIVE &&
      existingSub.currentPeriodEnd != null &&
      existingSub.currentPeriodEnd > now

    const baseDate = isCurrentlyActive ? existingSub!.currentPeriodEnd! : now
    const currentPeriodEnd = new Date(baseDate.getTime() + periodMs)

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: now,
          // Сохраняем перепроверенный ответ провайдера, а не исходное (недоверенное) тело webhook.
          rawPayload: remote as unknown as Prisma.InputJsonValue
        }
      }),
      this.prisma.subscription.upsert({
        where: { workspaceId: payment.workspaceId },
        create: {
          workspaceId: payment.workspaceId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
          provider: payment.provider
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
          provider: payment.provider
        }
      })
    ])

    this.logger.log(
      `Subscription ${isCurrentlyActive ? 'extended' : 'activated'}: workspace=${payment.workspaceId} plan=${plan.code} periodEnd=${currentPeriodEnd.toISOString()}`
    )

    return { ok: true }
  }

  private async confirmAndCancel(payment: Awaited<ReturnType<typeof this.prisma.payment.findUnique>> & Record<string, any>) {
    const providerPaymentId = payment.providerPaymentId as string
    const remote = await this.verifyPaymentWithProvider(providerPaymentId)

    if (remote.status !== 'canceled') {
      this.logger.warn(
        `Webhook claimed payment.canceled but provider reports status=${remote.status} for ${providerPaymentId} — ignoring`
      )
      return { ok: true, ignored: true }
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CANCELED,
        canceledAt: new Date(),
        rawPayload: remote as unknown as Prisma.InputJsonValue
      }
    })

    this.logger.log(`Payment canceled: ${providerPaymentId}`)

    return { ok: true }
  }

  // Синхронизирует статус PENDING-платежей с ЮKassa.
  // Вызывается при открытии страницы биллинга — защита от потери платежа
  // при закрытии вкладки после оплаты (до получения webhook).
  async syncPendingPayments(userId: string): Promise<{ synced: number }> {
    const workspaceId = await this.entitlements.resolveWorkspaceId(userId)

    const pending = await this.prisma.payment.findMany({
      where: {
        workspaceId,
        provider: BillingProvider.YOOKASSA,
        status: PaymentStatus.PENDING,
        providerPaymentId: { not: null }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    if (!pending.length) return { synced: 0 }

    let synced = 0

    for (const payment of pending) {
      try {
        const remote = await this.verifyPaymentWithProvider(payment.providerPaymentId!)

        if (remote.status === 'succeeded' && remote.paid !== false) {
          await this.confirmAndActivate(payment)
          synced++
        } else if (remote.status === 'canceled') {
          await this.confirmAndCancel(payment)
          synced++
        }
      } catch {
        // верификация недоступна/платёж ещё не готов — пропускаем, попробуем в следующий раз
      }
    }

    return { synced }
  }
}
