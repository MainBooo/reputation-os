import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { SuperAdminGuard } from '../../common/guards/super-admin.guard'
import { AdminBillingService } from './admin-billing.service'
import { AdminUpdateSubscriptionDto } from './dto/admin-update-subscription.dto'
import { AdminSetOverrideDto } from './dto/admin-set-override.dto'

@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('admin/billing')
export class AdminBillingController {
  constructor(private readonly adminBilling: AdminBillingService) {}

  @Get('workspaces')
  workspaces() {
    return this.adminBilling.getWorkspaces()
  }

  @Get('plans')
  plans() {
    return this.adminBilling.getPlans()
  }

  @Patch('workspaces/:id/subscription')
  updateSubscription(@Param('id') id: string, @Body() dto: AdminUpdateSubscriptionDto) {
    return this.adminBilling.updateSubscription(id, dto)
  }

  @Put('workspaces/:id/overrides')
  setOverride(@Param('id') id: string, @Body() dto: AdminSetOverrideDto) {
    return this.adminBilling.setOverride(id, dto)
  }
}
