import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateMessageDto {
  @IsOptional()
  @IsString()
  workspaceId?: string

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  body!: string
}
