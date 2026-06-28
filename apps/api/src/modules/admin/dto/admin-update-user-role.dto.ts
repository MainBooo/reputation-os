import { IsEnum } from 'class-validator'
import { SystemRole } from '@prisma/client'

export class AdminUpdateUserRoleDto {
  @IsEnum(SystemRole)
  systemRole!: SystemRole
}
