import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { BillingController } from './billing.controller'
import { EntitlementsService } from './entitlements.service'

@Module({
  imports: [PrismaModule],
  controllers: [BillingController],
  providers: [EntitlementsService],
  exports: [EntitlementsService]
})
export class BillingModule {}
