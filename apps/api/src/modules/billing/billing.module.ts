import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { EntitlementsService } from './entitlements.service'
import { AdminBillingController } from './admin-billing.controller'
import { AdminBillingService } from './admin-billing.service'

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, AdminBillingController],
  providers: [EntitlementsService, BillingService, AdminBillingService],
  exports: [EntitlementsService, BillingService]
})
export class BillingModule {}
