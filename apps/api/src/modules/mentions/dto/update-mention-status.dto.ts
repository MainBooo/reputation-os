import { IsEnum } from 'class-validator'
import { MentionStatus } from '@prisma/client'

export class UpdateMentionStatusDto {
  @IsEnum(MentionStatus)
  status!: MentionStatus
}
