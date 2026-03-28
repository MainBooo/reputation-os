import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator'

export class CreateCompanyAliasDto {
  @IsString()
  @MinLength(1)
  value!: string

  @IsOptional()
  @IsInt()
  priority?: number

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean
}
