import { Module } from '@nestjs/common'
import { CompaniesController } from './companies.controller'
import { CompaniesService } from './companies.service'
import { BillingModule } from '../billing/billing.module'

@Module({
  imports: [BillingModule],
  controllers: [CompaniesController],
  providers: [CompaniesService]
})
export class CompaniesModule {}
