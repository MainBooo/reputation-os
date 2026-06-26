import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { AuthUser } from '../../common/auth/auth-user.type'
import { PrismaService } from '../../common/prisma/prisma.service'
import { EntitlementsService } from './entitlements.service'
import { BillingService, YookassaWebhookPayload } from './billing.service'
import { CreateCheckoutDto } from './dto/create-checkout.dto'

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
      select: { code: true, name: true, priceMonthly: true, limits: true }
    })
  }

  @UseGuards(JwtAuthGuard)
  @Get('entitlements')
  getEntitlements(@CurrentUser() user: AuthUser) {
    return this.entitlements.getForUser(user.id)
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckout(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckoutDto) {
    return this.billing.createCheckout(user.id, dto.planCode)
  }

  // Публичный эндпоинт: его вызывает ЮKassa (или mock-checkout страница).
  // TODO перед боевой ЮKassa: проверка подписи/allowlist IP ЮKassa.
  @Post('webhook')
  @HttpCode(200)
  handleWebhook(@Body() payload: YookassaWebhookPayload) {
    return this.billing.handleWebhook(payload)
  }
}
