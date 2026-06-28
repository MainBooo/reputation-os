import { IsInt, IsISO8601, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'

export class AdminAuditLogsQueryDto {
  @IsOptional() @IsString() action?: string
  @IsOptional() @IsString() actorUserId?: string
  @IsOptional() @IsString() workspaceId?: string
  @IsOptional() @IsString() targetUserId?: string
  @IsOptional() @IsISO8601() dateFrom?: string
  @IsOptional() @IsISO8601() dateTo?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number
}
