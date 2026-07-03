function envNumber(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const RATE_LIMIT_MESSAGE = 'Слишком много запросов. Попробуйте позже.'

// limit = попыток за ttl (мс). Настраивается через ENV, см. .env.example.
export const RATE_LIMITS = {
  login: {
    limit: envNumber('RATE_LIMIT_LOGIN_MAX', 5),
    ttl: envNumber('RATE_LIMIT_LOGIN_TTL_MS', 15 * 60_000)
  },
  register: {
    limit: envNumber('RATE_LIMIT_REGISTER_MAX', 3),
    ttl: envNumber('RATE_LIMIT_REGISTER_TTL_MS', 60 * 60_000)
  },
  createCompany: {
    limit: envNumber('RATE_LIMIT_CREATE_COMPANY_MAX', 10),
    ttl: envNumber('RATE_LIMIT_CREATE_COMPANY_TTL_MS', 60 * 60_000)
  },
  discoverSources: {
    limit: envNumber('RATE_LIMIT_DISCOVER_SOURCES_MAX', 5),
    ttl: envNumber('RATE_LIMIT_DISCOVER_SOURCES_TTL_MS', 60 * 60_000)
  },
  billingCheckout: {
    limit: envNumber('RATE_LIMIT_BILLING_CHECKOUT_MAX', 10),
    ttl: envNumber('RATE_LIMIT_BILLING_CHECKOUT_TTL_MS', 15 * 60_000)
  }
}
