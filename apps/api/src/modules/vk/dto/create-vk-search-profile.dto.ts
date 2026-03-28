import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { VkMonitoringMode } from '@prisma/client'

export class CreateVkSearchProfileDto {
  @IsString()
  query!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  priority?: number

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsEnum(VkMonitoringMode)
  mode!: VkMonitoringMode
}
