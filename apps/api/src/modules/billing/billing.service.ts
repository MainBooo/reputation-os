import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from '@nestjs/common'
import { BillingProvider, PaymentStatus, PlanCode, Prisma, SubscriptionStatus, WorkspaceRole } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { PaymentProvider, createPaymentProvider } from './billing.providers'

const PERIOD_DAYS_MONTHLY = 30
const PERIOD_DAYS_YEARLY = 365
const PLAN_RANK: Record<PlanCode, number> = {
  FREE: 0,
  START: 1,
  STARTER: 1,
  PRO: 2,
  BUSINESS: 2,
  AGENCY: 3,
  ENTERPRISE: 4,
  CUSTOM: 4
}

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

  constructor(private readonly prisma: PrismaService) {}

  private async assertBillingOwner(userId: string, workspaceId: string) {
    if (!workspaceId) throw new BadRequestException('workspaceId is required')

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, isActive: true }
    })
    if (!workspace) throw new NotFoundException('Workspace not found')
    if (!workspace.isActive) throw new ForbiddenException('Workspace is disabled')

    const member = await this.prisma.workspaceMember.findFirst({
      where: { userId, workspaceId },
      select: { role: true }
    })
    if (!member) throw new ForbiddenException('No access to workspace')
    if (member.role !== WorkspaceRole.OWNER) {
      throw new ForbiddenException('Only workspace OWNER can manage billing')
    }

    return workspace
  }

  private getPeriodMs(period: string) {
    const days = period === 'yearly' ? PERIOD_DAYS_YEARLY : PERIOD_DAYS_MONTHLY
    return days * 24 * 60 * 60 * 1000
  }

  private getCheckoutAmount(plan: { priceMonthly: number; priceYearly: number | null }, period: 'monthly' | 'yearly') {
    if (period === 'yearly') {
      if (plan.priceYearly == null || plan.priceYearly <= 0) {
        throw new BadRequestException('Yearly billing is not available for this plan')
      }
      return plan.priceYearly
    }

    if (plan.priceMonthly <= 0) throw new BadRequestException('Plan is free, no checkout required')
    return plan.priceMonthly
  }

  async createCheckout(
    userId: string,
    workspaceId: string,
    planCode: PlanCode,
    period: 'monthly' | 'yearly' = 'monthly'
  ) {
    await this.assertBillingOwner(userId, workspaceId)

    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })

    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found')
    const amount = this.getCheckoutAmount(plan, period)

    const scheduled = await this.prisma.subscription.findUnique({
      where: { workspaceId },
      select: { scheduledAt: true, scheduledPlanId: true }
    })
    if (scheduled?.scheduledPlanId && scheduled.scheduledAt && scheduled.scheduledAt > new Date()) {
      throw new ConflictException('A plan change is already scheduled for this workspace')
    }

    let payment
    try {
      payment = await this.prisma.payment.create({
        data: {
          workspaceId,
          userId,
          planCode,
          amount,
          billingPeriod: period,
          checkoutKey: `workspace:${workspaceId}`,
          provider: this.provider.name === 'YOOKASSA' ? BillingProvider.YOOKASSA : BillingProvider.MOCK
        }
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A checkout is already pending for this workspace')
      }
      throw error
    }

    const returnUrl =
      process.env.YOOKASSA_RETURN_URL ||
      `${process.env.FRONTEND_URL || 'https://reputation.generationweb.ru'}/billing/payment-result`

    const periodLabel = period === 'yearly' ? 'годовая' : 'месячная'
    let providerPayment
    try {
      providerPayment = await this.provider.createPayment({
        paymentId: payment.id,
        amount,
        description: `Подписка ${plan.name} (${periodLabel}) — ReputationOS`,
        metadata: { paymentId: payment.id, workspaceId, planCode, billingPeriod: period },
        returnUrl
      })
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.CANCELED, canceledAt: new Date(), checkoutKey: null }
      }).catch(() => null)
      throw new BadRequestException('Unable to create payment')
    }

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
    if (!remote.amount) {
      if (this.provider.name === 'YOOKASSA') {
        throw new BadRequestException('Payment amount is missing from provider response')
      }
      return
    }

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
    const billingPeriod = payment.billingPeriod === 'yearly' ? 'yearly' : 'monthly'
    const periodMs = this.getPeriodMs(billingPeriod)

    const outcome = await this.prisma.$transaction(async (tx) => {
      const freshPayment = await tx.payment.findUnique({ where: { id: payment.id } })
      if (!freshPayment) throw new NotFoundException('Payment not found')
      if (freshPayment.status === PaymentStatus.SUCCEEDED) return { alreadyProcessed: true }
      if (freshPayment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment is not pending')
      }

      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.SUCCEEDED,
          paidAt: now,
          checkoutKey: null,
          rawPayload: remote as unknown as Prisma.InputJsonValue
        }
      })
      if (claimed.count !== 1) return { alreadyProcessed: true }

      const existing = await tx.subscription.findUnique({
        where: { workspaceId: payment.workspaceId },
        include: { plan: true, scheduledPlan: true }
      })

      const dueScheduledPlan =
        existing?.scheduledPlan && existing.scheduledAt && existing.scheduledAt <= now
          ? existing.scheduledPlan
          : null
      const currentPlan = dueScheduledPlan ?? existing?.plan ?? null
      const isActive =
        existing?.status === SubscriptionStatus.ACTIVE &&
        existing.currentPeriodEnd != null &&
        existing.currentPeriodEnd > now

      const materializedBase = dueScheduledPlan
        ? {
            planId: dueScheduledPlan.id,
            billingPeriod: existing!.scheduledBillingPeriod || existing!.billingPeriod,
            currentPeriodStart: existing!.scheduledAt,
            scheduledPlanId: null,
            scheduledBillingPeriod: null,
            scheduledAt: null
          }
        : {}

      const isDowngrade =
        isActive && currentPlan != null && PLAN_RANK[plan.code] < PLAN_RANK[currentPlan.code]

      if (!existing) {
        const currentPeriodEnd = new Date(now.getTime() + periodMs)
        await tx.subscription.create({
          data: {
            workspaceId: payment.workspaceId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            billingPeriod,
            currentPeriodStart: now,
            currentPeriodEnd,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
            provider: payment.provider
          }
        })
        return { alreadyProcessed: false, scheduled: false, currentPeriodEnd }
      }

      if (isDowngrade) {
        const switchAt = existing.currentPeriodEnd!
        const currentPeriodEnd = new Date(switchAt.getTime() + periodMs)
        await tx.subscription.update({
          where: { workspaceId: payment.workspaceId },
          data: {
            ...materializedBase,
            status: SubscriptionStatus.ACTIVE,
            currentPeriodEnd,
            scheduledPlanId: plan.id,
            scheduledBillingPeriod: billingPeriod,
            scheduledAt: switchAt,
            trialEndsAt: null,
            cancelAtPeriodEnd: false,
            provider: payment.provider
          }
        })
        return { alreadyProcessed: false, scheduled: true, currentPeriodEnd, switchAt }
      }

      const samePlan = isActive && currentPlan?.id === plan.id
      const baseDate = samePlan ? existing.currentPeriodEnd! : now
      const currentPeriodEnd = new Date(baseDate.getTime() + periodMs)
      await tx.subscription.update({
        where: { workspaceId: payment.workspaceId },
        data: {
          ...materializedBase,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          billingPeriod,
          currentPeriodStart: samePlan ? existing.currentPeriodStart ?? now : now,
          currentPeriodEnd,
          scheduledPlanId: null,
          scheduledBillingPeriod: null,
          scheduledAt: null,
          trialEndsAt: null,
          cancelAtPeriodEnd: false,
          provider: payment.provider
        }
      })
      return { alreadyProcessed: false, scheduled: false, currentPeriodEnd }
    })

    if (outcome.alreadyProcessed) return { ok: true, alreadyProcessed: true }

    this.logger.log(
      `Subscription ${outcome.scheduled ? 'downgrade scheduled' : 'activated'}: workspace=${payment.workspaceId} plan=${plan.code} periodEnd=${outcome.currentPeriodEnd?.toISOString()}`
    )

    return { ok: true, scheduled: outcome.scheduled }
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

    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        status: PaymentStatus.CANCELED,
        canceledAt: new Date(),
        checkoutKey: null,
        rawPayload: remote as unknown as Prisma.InputJsonValue
      }
    })

    this.logger.log(`Payment canceled: ${providerPaymentId}`)

    return { ok: true }
  }

  // Синхронизирует статус PENDING-платежей с ЮKassa.
  // Вызывается при открытии страницы биллинга — защита от потери платежа
  // при закрытии вкладки после оплаты (до получения webhook).
  async syncPendingPayments(userId: string, workspaceId: string): Promise<{ synced: number }> {
    await this.assertBillingOwner(userId, workspaceId)

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
      } catch (error) {
        this.logger.warn(
          `Pending payment sync failed for payment=${payment.id}: ${error instanceof Error ? error.message : 'unknown error'}`
        )
      }
    }

    return { synced }
  }

  async cancelAtPeriodEnd(userId: string, workspaceId: string) {
    await this.assertBillingOwner(userId, workspaceId)

    const subscription = await this.prisma.subscription.findUnique({ where: { workspaceId } })
    if (!subscription) throw new NotFoundException('Subscription not found')

    await this.prisma.subscription.update({
      where: { workspaceId },
      data: { cancelAtPeriodEnd: true }
    })

    return { ok: true, effectiveAt: subscription.currentPeriodEnd }
  }
}
