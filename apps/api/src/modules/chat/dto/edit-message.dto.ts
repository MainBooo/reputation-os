import { IsString, MaxLength, MinLength } from 'class-validator'

export class EditMessageDto {
  @IsString()
  workspaceId!: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string
}
