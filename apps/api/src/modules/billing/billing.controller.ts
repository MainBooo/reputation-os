import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common'
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
import { userTracker } from '../../common/rate-limit/rate-limit-trackers'

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

  @UseGuards(JwtAuthGuard)
  @Get('entitlements')
  getEntitlements(@CurrentUser() user: AuthUser) {
    return this.entitlements.getForUser(user.id)
  }

  // ── Legacy checkout (mock-provider, keeps backward compat) ─────────────────
  @UseGuards(JwtAuthGuard, AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.billingCheckout, getTracker: userTracker } })
  @Post('checkout')
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.id, dto.planCode)
  }

  // ── YooKassa: create payment (реальный чекаут, вызывается фронтендом) ──────
  @UseGuards(JwtAuthGuard, AppThrottlerGuard)
  @Throttle({ default: { ...RATE_LIMITS.billingCheckout, getTracker: userTracker } })
  @Post('yookassa/create-payment')
  createYookassaPayment(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.id, dto.planCode, dto.period ?? 'monthly')
  }

  // ── YooKassa: sync pending payments ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('yookassa/sync')
  syncPendingPayments(@CurrentUser() user: AuthUser) {
    return this.billing.syncPendingPayments(user.id)
  }

  // ── YooKassa: webhook (no secret header — YooKassa uses IP allowlisting) ──
  // Idempotent: repeated events are safely ignored.
  // Намеренно без AppThrottlerGuard — это server-to-server callback от ЮKassa
  // (может ретраить события), а не публичный пользовательский эндпоинт.
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
