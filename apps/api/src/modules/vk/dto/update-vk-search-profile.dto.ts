import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { VkMonitoringMode } from '@prisma/client'

export class UpdateVkSearchProfileDto {
  @IsOptional()
  @IsString()
  query?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsEnum(VkMonitoringMode)
  mode?: VkMonitoringMode
}
