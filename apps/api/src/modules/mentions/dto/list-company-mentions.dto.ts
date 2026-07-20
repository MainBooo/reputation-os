import { IsBooleanString, IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator'
import { MentionStatus, MentionType, MessageClassification, MessageUrgency, Platform, Sentiment } from '@prisma/client'
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number

  @IsOptional()
  @IsEnum(MessageClassification)
  messageClassification?: MessageClassification

  @IsOptional()
  @IsEnum(MessageUrgency)
  messageUrgency?: MessageUrgency

  @IsOptional()
  @IsBooleanString()
  needsManualReview?: string

  @IsOptional()
  @IsBooleanString()
  includeHidden?: string

  /** Powers the "Не по теме" filter: matches messageClassification=IRRELEVANT
   *  OR a human reviewDecision=IRRELEVANT, and implies includeHidden (some
   *  IRRELEVANT mentions have isInboxVisible=false at high confidence). */
  @IsOptional()
  @IsBooleanString()
  onlyIrrelevant?: string
}
