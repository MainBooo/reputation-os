import * as Joi from 'joi'

export function envValidation(config: Record<string, unknown>) {
  const schema = Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    REDIS_URL: Joi.string().required(),
    PORT: Joi.number().default(3000),
    DEMO_MODE: Joi.string().valid('true', 'false').default('true')
  })

  const { error, value } = schema.validate(config, { allowUnknown: true })
  if (error) throw new Error(`Env validation error: ${error.message}`)
  return value
}
