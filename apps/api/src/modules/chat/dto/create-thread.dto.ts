import { IsEnum, IsOptional, IsString } from 'class-validator'
import { ChatThreadType } from '@prisma/client'

export class CreateThreadDto {
  @IsString()
  workspaceId!: string

  @IsEnum(ChatThreadType)
  type!: ChatThreadType

  @IsOptional()
  @IsString()
  companyId?: string

  @IsOptional()
  @IsString()
  mentionId?: string

  @IsOptional()
  @IsString()
  title?: string
}
