import { registerDecorator, ValidationOptions } from 'class-validator'
import { isSafeExternalUrl } from './safe-url'

// Async class-validator constraint — NestJS's global ValidationPipe awaits
// validation promises, so this runs correctly without extra wiring.
// Rejects at DTO level (create/update source target) before the value ever
// reaches the DB or the worker. See safe-url.ts for the exact rule set.
export function IsSafeExternalUrl(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isSafeExternalUrl',
      target: object.constructor,
      propertyName,
      options: {
        message: 'externalUrl must be a public http(s) URL (no local/private/metadata addresses)',
        ...validationOptions
      },
      validator: {
        async validate(value: unknown) {
          if (value === undefined || value === null || value === '') return true // @IsOptional handles required-ness
          if (typeof value !== 'string') return false
          return isSafeExternalUrl(value)
        }
      }
    })
  }
}
