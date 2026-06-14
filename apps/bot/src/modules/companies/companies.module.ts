import { Module } from '@nestjs/common'
import { CompaniesUpdate } from './companies.update'
import { CompaniesService } from './companies.service'

@Module({
  providers: [CompaniesUpdate, CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
