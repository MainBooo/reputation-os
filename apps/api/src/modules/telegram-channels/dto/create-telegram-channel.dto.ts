import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateTelegramChannelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  username!: string
}
