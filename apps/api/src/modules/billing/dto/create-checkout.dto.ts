import { PlanCode } from '@prisma/client'
import { IsEnum, IsIn, IsOptional } from 'class-validator'

export class CreateCheckoutDto {
  @IsEnum(PlanCode)
  planCode!: PlanCode

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  period?: 'monthly' | 'yearly'
}
