import { IsArray, IsOptional, IsString } from 'class-validator'

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string

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
  description?: string

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
