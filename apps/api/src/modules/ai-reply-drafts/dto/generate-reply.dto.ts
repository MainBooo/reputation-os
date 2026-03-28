import { IsOptional, IsString } from 'class-validator'

export class GenerateReplyDto {
  @IsOptional()
  @IsString()
  languageCode?: string

  @IsOptional()
  @IsString()
  tone?: string
}
