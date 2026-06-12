import { PlanCode, SubscriptionStatus } from '@prisma/client'
import { IsEnum, IsISO8601, IsOptional } from 'class-validator'

export class AdminUpdateSubscriptionDto {
  @IsEnum(PlanCode)
  planCode!: PlanCode

  @IsOptional()
  @IsISO8601()
  currentPeriodEnd?: string

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus
}
