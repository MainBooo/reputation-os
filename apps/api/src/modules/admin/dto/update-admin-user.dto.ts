import { IsBoolean, IsEnum, IsOptional } from 'class-validator'
import { SystemRole } from '@prisma/client'

export class UpdateAdminUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean

  @IsOptional()
  @IsEnum(SystemRole)
  systemRole?: SystemRole
}
