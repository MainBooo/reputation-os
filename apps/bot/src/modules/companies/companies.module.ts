import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { CompaniesUpdate } from './companies.update'
import { CompaniesService } from './companies.service'

@Module({
  imports: [ConfigModule],
  providers: [CompaniesUpdate, CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
