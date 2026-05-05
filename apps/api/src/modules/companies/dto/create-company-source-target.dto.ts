import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateCompanySourceTargetDto {
  @IsOptional()
  @IsString()
  sourceId?: string

  @IsOptional()
  @IsIn(['WEB', 'CUSTOM'])
  platform?: 'WEB' | 'CUSTOM'

  @IsOptional()
  @IsString()
  externalPlaceId?: string

  @IsOptional()
  @IsString()
  externalUrl?: string

  @IsOptional()
  @IsString()
  displayName?: string

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
