import { IsArray, IsOptional, IsString, MinLength } from 'class-validator'

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

  @IsOptional()
  @IsString()
  twoGisUrl?: string

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[]
}
