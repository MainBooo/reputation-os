import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { SystemRole } from '@prisma/client'

export class AdminUsersQueryDto {
  @IsOptional() @IsString() q?: string
  @IsOptional() @IsEnum(SystemRole) systemRole?: SystemRole
  @IsOptional() @IsString() status?: 'active' | 'disabled'
  @IsOptional() @IsString() workspaceId?: string
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number
}
