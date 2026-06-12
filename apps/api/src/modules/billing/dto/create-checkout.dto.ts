import { PlanCode } from '@prisma/client'
import { IsEnum } from 'class-validator'

export class CreateCheckoutDto {
  @IsEnum(PlanCode)
  planCode!: PlanCode
}
