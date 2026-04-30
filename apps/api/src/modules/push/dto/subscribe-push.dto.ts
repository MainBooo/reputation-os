import { IsArray, IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

const allowedSentiments = ['NEGATIVE', 'POSITIVE', 'NEUTRAL'] as const

export class SubscribePushDto {
  @IsString()
  @IsNotEmpty()
  workspaceId!: string

  @IsString()
  @IsNotEmpty()
  endpoint!: string

  @IsObject()
  keys!: {
    p256dh: string
    auth: string
  }

  @IsOptional()
  @IsString()
  userAgent?: string

  @IsOptional()
  @IsArray()
  @IsIn(allowedSentiments, { each: true })
  alertSentiments?: string[]
}
