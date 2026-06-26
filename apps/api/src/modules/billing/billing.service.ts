import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { BillingProvider, PaymentStatus, PlanCode, Prisma, SubscriptionStatus } from '@prisma/client'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'
import { PaymentProvider, createPaymentProvider } from './billing.providers'

const PERIOD_DAYS = 30

// Формат вебхука ЮKassa: { type: 'notification', event: 'payment.succeeded', object: { id, ... } }
export interface YookassaWebhookPayload {
  type?: string
  event?: string
  object?: {
    id?: string
    status?: string
    metadata?: Record<string, string>
  }
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)
  private readonly provider: PaymentProvider = createPaymentProvider()

  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService
  ) {}

  async createCheckout(userId: string, planCode: PlanCode) {
    const workspaceId = await this.entitlements.resolveWorkspaceId(userId)

    const plan = await this.prisma.plan.findUnique({ where: { code: planCode } })

    if (!plan || !plan.isActive) throw new NotFoundException('Plan not found')
    if (plan.priceMonthly <= 0) throw new BadRequestException('Plan is free, no checkout required')

    const payment = await this.prisma.payment.create({
      data: {
        workspaceId,
        planCode,
        amount: plan.priceMonthly,
        provider: this.provider.name === 'YOOKASSA' ? BillingProvider.YOOKASSA : BillingProvider.MOCK
      }
    })

    const providerPayment = await this.provider.createPayment({
      paymentId: payment.id,
      amount: plan.priceMonthly,
      description: `Подписка ${plan.name} — ReputationOS`,
      metadata: { paymentId: payment.id, workspaceId, planCode },
      returnUrl: `${process.env.FRONTEND_URL || 'https://reputation.generationweb.ru'}/settings/billing`
    })

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerPaymentId: providerPayment.id }
    })

    return { paymentId: payment.id, confirmationUrl: providerPayment.confirmationUrl }
  }

  async handleWebhook(payload: YookassaWebhookPayload) {
    this.logger.log(`Billing webhook received: ${payload?.event ?? 'unknown'}`)

    if (payload?.event !== 'payment.succeeded') return { ok: true, ignored: true }

    const providerPaymentId = payload.object?.id

    if (!providerPaymentId) throw new BadRequestException('object.id is required')

    const payment = await this.prisma.payment.findUnique({ where: { providerPaymentId } })

    if (!payment) throw new NotFoundException('Payment not found')
    if (payment.status === PaymentStatus.SUCCEEDED) return { ok: true, alreadyProcessed: true }

    const plan = await this.prisma.plan.findUnique({ where: { code: payment.planCode } })

    if (!plan) throw new NotFoundException('Plan not found')

    const currentPeriodEnd = new Date(Date.now() + PERIOD_DAYS * 24 * 60 * 60 * 1000)

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          rawPayload: payload as Prisma.InputJsonValue
        }
      }),
      this.prisma.subscription.upsert({
        where: { workspaceId: payment.workspaceId },
        create: {
          workspaceId: payment.workspaceId,
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
          provider: payment.provider
        },
        update: {
          planId: plan.id,
          status: SubscriptionStatus.ACTIVE,
          currentPeriodEnd,
          provider: payment.provider
        }
      })
    ])

    this.logger.log(`Subscription activated: workspace=${payment.workspaceId} plan=${plan.code}`)

    return { ok: true }
  }
}
