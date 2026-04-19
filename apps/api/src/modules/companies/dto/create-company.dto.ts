import { IsOptional, IsString, MinLength } from 'class-validator'

export class CreateCompanyDto {
  @IsString()
  workspaceId!: string

  @IsString()
  @MinLength(2)
  name!: string

  @IsOptional()
  @IsString()
  website?: string

  @IsOptional()
  @IsString()
  city?: string

  @IsOptional()
  @IsString()
  industry?: string

  @IsOptional()
  @IsString()
  yandexUrl?: string
}
