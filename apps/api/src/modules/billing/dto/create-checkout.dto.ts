import { PlanCode } from '@prisma/client'
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class CreateCheckoutDto {
  @IsString()
  @IsNotEmpty()
  workspaceId!: string

  @IsEnum(PlanCode)
  planCode!: PlanCode

  @IsOptional()
  @IsIn(['monthly', 'yearly'])
  period?: 'monthly' | 'yearly'
}
