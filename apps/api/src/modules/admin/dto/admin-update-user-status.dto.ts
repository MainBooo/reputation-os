import { IsBoolean } from 'class-validator'

export class AdminUpdateUserStatusDto {
  @IsBoolean()
  isActive!: boolean
}
