import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Type } from 'class-transformer'
import { PlanCode } from '@prisma/client'

export class AdminWorkspacesQueryDto {
  @IsOptional() @IsString() q?: string
  @IsOptional() @IsEnum(PlanCode) plan?: PlanCode
  @IsOptional() @IsString() status?: 'active' | 'disabled'
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number
}
