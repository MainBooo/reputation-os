import { IsEmail, IsEnum } from 'class-validator'
import { WorkspaceRole } from '@prisma/client'

export class CreateWorkspaceInviteDto {
  @IsEmail()
  email!: string

  @IsEnum(WorkspaceRole)
  role!: WorkspaceRole
}
