import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'
import { IsSafeExternalUrl } from '../../../common/security/is-safe-external-url.validator'

export class UpdateCompanySourceTargetDto {
  @IsOptional()
  @IsString()
  externalPlaceId?: string

  @IsOptional()
  @IsString()
  @IsSafeExternalUrl()
  externalUrl?: string

  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsBoolean()
  syncReviewsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  syncRatingsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  syncMentionsEnabled?: boolean

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>
}
