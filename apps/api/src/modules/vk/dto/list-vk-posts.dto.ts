import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator'
import { VkMonitoringMode } from '@prisma/client'

export class ListVkPostsDto {
  @IsOptional()
  @IsEnum(VkMonitoringMode)
  mode?: VkMonitoringMode

  @IsOptional()
  @IsString()
  communityId?: string

  @IsOptional()
  @IsDateString()
  discoveredFrom?: string

  @IsOptional()
  @IsDateString()
  discoveredTo?: string
}
