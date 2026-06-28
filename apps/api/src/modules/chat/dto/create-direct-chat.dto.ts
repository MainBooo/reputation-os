import { Transform } from 'class-transformer'
import { IsEmail } from 'class-validator'

export class CreateDirectChatDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string
}
