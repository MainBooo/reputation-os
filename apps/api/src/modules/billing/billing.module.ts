import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { EntitlementsService } from './entitlements.service'

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [EntitlementsService, BillingService],
  exports: [EntitlementsService, BillingService]
})
export class BillingModule {}
