import * as Joi from 'joi'

export function envValidation(config: Record<string, unknown>) {
  const schema = Joi.object({
    DATABASE_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    REDIS_URL: Joi.string().required(),
    PORT: Joi.number().default(3000),
    DEMO_MODE: Joi.string().valid('true', 'false').default('true'),
    BILLING_PROVIDER: Joi.string().valid('mock', 'yookassa').default('mock'),
    YOOKASSA_SHOP_ID: Joi.string().allow('').optional(),
    YOOKASSA_SECRET_KEY: Joi.string().allow('').optional(),
    YOOKASSA_RETURN_URL: Joi.string().allow('').optional()
  })

  const { error, value } = schema.validate(config, { allowUnknown: true })
  if (error) throw new Error(`Env validation error: ${error.message}`)
  return value
}
