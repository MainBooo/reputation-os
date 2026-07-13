import { IsIn, IsOptional, IsString } from 'class-validator'

export class GenerateReplyDto {
  @IsOptional()
  @IsString()
  languageCode?: string

  @IsOptional()
  @IsString()
  tone?: string

  @IsOptional()
  @IsIn(['FORMAL', 'FRIENDLY', 'CONCISE'])
  preset?: 'FORMAL' | 'FRIENDLY' | 'CONCISE'
}
