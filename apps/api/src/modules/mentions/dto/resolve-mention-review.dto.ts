import { IsEnum } from 'class-validator'
import { MentionReviewDecision } from '@prisma/client'

export class ResolveMentionReviewDto {
  @IsEnum(MentionReviewDecision)
  decision!: MentionReviewDecision
}
