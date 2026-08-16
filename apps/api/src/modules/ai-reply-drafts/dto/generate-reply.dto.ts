import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

export class GenerateReplyDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestId?: string

  @IsOptional()
  @IsString()
  @MaxLength(10)
  languageCode?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  tone?: string

  @IsOptional()
  @IsIn(['FORMAL', 'FRIENDLY', 'CONCISE'])
  preset?: 'FORMAL' | 'FRIENDLY' | 'CONCISE'
}
