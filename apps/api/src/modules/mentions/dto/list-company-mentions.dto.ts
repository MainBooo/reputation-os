import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator'
import { MentionStatus, MentionType, Platform, Sentiment } from '@prisma/client'
import { Type } from 'class-transformer'

export class ListCompanyMentionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20

  @IsOptional()
  @IsEnum(Platform)
  platform?: Platform

  @IsOptional()
  @IsEnum(Sentiment)
  sentiment?: Sentiment

  @IsOptional()
  @IsEnum(MentionStatus)
  status?: MentionStatus

  @IsOptional()
  @IsDateString()
  from?: string

  @IsOptional()
  @IsDateString()
  to?: string

  @IsOptional()
  @IsEnum(MentionType)
  type?: MentionType
}
