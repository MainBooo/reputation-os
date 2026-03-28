import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator'
import { VkTrackedCommunityMode } from '@prisma/client'

export class UpdateVkTrackedCommunityDto {
  @IsOptional()
  @IsEnum(VkTrackedCommunityMode)
  mode?: VkTrackedCommunityMode

  @IsOptional()
  @IsString()
  vkCommunityId?: string

  @IsOptional()
  @IsString()
  screenName?: string

  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  url?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
