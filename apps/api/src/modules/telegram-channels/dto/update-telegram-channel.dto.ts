import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator'

export class UpdateTelegramChannelDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(1440)
  checkIntervalMin?: number
}
