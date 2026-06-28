import { IsBoolean } from 'class-validator'

export class AdminUpdateWorkspaceStatusDto {
  @IsBoolean()
  isActive!: boolean
}
