import { IsIn, IsOptional, IsString } from 'class-validator'
import { FEATURE_KEYS } from '../billing.constants'

export class AdminSetOverrideDto {
  @IsString()
  @IsIn(FEATURE_KEYS as unknown as string[])
  featureKey!: string

  // null или отсутствие value = удалить оверрайд, иначе установить JSON-значение
  @IsOptional()
  value?: unknown

  @IsOptional()
  @IsString()
  note?: string
}
