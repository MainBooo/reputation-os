import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'
import { BillingService, YookassaWebhookPayload } from './billing.service'
import { CreateCheckoutDto } from './dto/create-checkout.dto'
import { AppThrottlerGuard } from '../../common/rate-limit/app-throttler.guard'
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.config'
import { userTracker, ipTracker } from '../../common/rate-limit/rate-limit-trackers'

@Controller('billing')
export class BillingController {
  constructor(
    private readonly entitlements: EntitlementsService,
    private readonly billing: BillingService,
    private readonly prisma: PrismaService
  ) {}

  @Get('plans')
  getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: 'asc' },
      select: { code: true, name: true, priceMonthly: true, priceYearly: true, limits: true }
    })
  }

  // workspaceId необязателен для обратной совместимости старых клиентов,
  // но фронтенд должен передавать текущий выбранный workspace явно —
  // без него бэкенд не может знать, какой workspace сейчас открыт в UI.
  @UseGuards(JwtAuthGuard)
  @Get('entitlements')
  async getEntitlements(@CurrentUser() user: AuthUser, @Query('workspaceId') workspaceId?: string) {
    if (workspaceId) {
      await this.entitlements.assertMember(user.id, workspaceId)
      return this.entitlements.getForWorkspace(workspaceId)
    }
    return this.entitlements.getForUser(user.id)
  }

  // ── Legacy checkout (mock-provider, keeps backward compat) ─────────────────
  @UseGuards(JwtAuthGuard, AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.billingCheckout, getTracker: userTracker } })
  @Post('checkout')
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.id, dto.workspaceId, dto.planCode, dto.period ?? 'monthly')
  }

  // ── YooKassa: create payment (реальный чекаут, вызывается фронтендом) ──────
  @UseGuards(JwtAuthGuard, AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.billingCheckout, getTracker: userTracker } })
  @Post('yookassa/create-payment')
  createYookassaPayment(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.id, dto.workspaceId, dto.planCode, dto.period ?? 'monthly')
  }

  // ── YooKassa: sync pending payments ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('yookassa/sync')
  syncPendingPayments(@CurrentUser() user: AuthUser, @Body('workspaceId') workspaceId: string) {
    return this.billing.syncPendingPayments(user.id, workspaceId)
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel-at-period-end')
  cancelAtPeriodEnd(@CurrentUser() user: AuthUser, @Body('workspaceId') workspaceId: string) {
    return this.billing.cancelAtPeriodEnd(user.id, workspaceId)
  }

  // ── YooKassa: webhook ───────────────────────────────────────────────────────
  // Тело запроса НЕ является источником истины: BillingService.handleWebhook
  // берёт из него только providerPaymentId и перепроверяет реальный статус
  // платежа прямым server-to-server запросом к API ЮKassa нашими credentials —
  // поэтому подделать payment.succeeded, зная свой providerPaymentId (виден в
  // confirmationUrl), больше нельзя. Rate-limit — щадящий, чтобы не блокировать
  // легитимные ретраи ЮKassa, но пресекать перебор providerPaymentId с адреса.
  // Idempotent: repeated events are safely ignored.
  @UseGuards(AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.billingWebhook, getTracker: ipTracker } })
  @Post('yookassa/webhook')
  @HttpCode(200)
  handleYookassaWebhook(@Body() payload: YookassaWebhookPayload) {
    return this.billing.handleWebhook(payload)
  }

  // ── Legacy webhook: requires internal secret header ────────────────────────
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(
    @Headers('x-billing-webhook-secret') secret: string | undefined,
    @Body() payload: YookassaWebhookPayload
  ) {
    const expected = process.env.BILLING_WEBHOOK_SECRET
    if (!expected || secret !== expected) {
      throw new ForbiddenException('Invalid webhook secret')
    }
    return this.billing.handleWebhook(payload)
  }
}
