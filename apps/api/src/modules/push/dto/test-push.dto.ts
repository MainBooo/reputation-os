import { IsOptional, IsString } from 'class-validator'

export class TestPushDto {
  @IsOptional()
  @IsString()
  workspaceId?: string
}
