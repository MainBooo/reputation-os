import { IsString } from 'class-validator'

export class AcceptWorkspaceInviteDto {
  @IsString()
  token!: string
}
