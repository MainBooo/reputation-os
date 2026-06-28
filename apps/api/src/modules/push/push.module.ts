import { Module } from '@nestjs/common'
import { PrismaModule } from '../../common/prisma/prisma.module'
import { BillingModule } from '../billing/billing.module'
import { PushController } from './push.controller'
import { PushService } from './push.service'

@Module({
  imports: [PrismaModule, BillingModule],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService]
})
export class PushModule {}
