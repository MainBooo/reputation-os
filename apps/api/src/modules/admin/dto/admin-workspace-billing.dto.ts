import { IsBoolean, IsEnum, IsISO8601, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PlanCode, SubscriptionStatus } from '@prisma/client'

export class AdminWorkspaceBillingDto {
  @IsOptional() @IsEnum(PlanCode) planCode?: PlanCode
  @IsOptional() @IsEnum(SubscriptionStatus) status?: SubscriptionStatus
  @IsOptional() @IsISO8601() currentPeriodEnd?: string
  @IsOptional() @IsISO8601() trialEndsAt?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxCompanies?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxSources?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxMembers?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxAiRepliesPerMonth?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(-1) maxWebPages?: number
  @IsOptional() @IsBoolean() webMonitoringEnabled?: boolean
  @IsOptional() @IsBoolean() telegramNotificationsEnabled?: boolean
  @IsOptional() @IsBoolean() pushNotificationsEnabled?: boolean
  @IsOptional() @IsString() adminNote?: string
}
