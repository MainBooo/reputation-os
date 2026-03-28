import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateCompanySourceTargetDto {
  @IsString()
  sourceId!: string

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
