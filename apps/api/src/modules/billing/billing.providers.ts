import { randomUUID } from 'crypto'

export interface CheckoutInput {
  paymentId: string
  amount: number
  description: string
  metadata: Record<string, string>
  returnUrl: string
}

export interface ProviderPayment {
  id: string
  status: string
  confirmationUrl: string | null
}

export interface PaymentProvider {
  readonly name: 'MOCK' | 'YOOKASSA'
  createPayment(input: CheckoutInput): Promise<ProviderPayment>
}

export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'MOCK' as const

  async createPayment(input: CheckoutInput): Promise<ProviderPayment> {
    const id = `mock_${randomUUID()}`
    const base = process.env.FRONTEND_URL || 'https://reputation.generationweb.ru'

    return {
      id,
      status: 'pending',
      confirmationUrl: `${base}/billing/mock-checkout?paymentId=${input.paymentId}&providerPaymentId=${id}`
    }
  }
}

// Боевой провайдер ЮKassa. Реализует тот же интерфейс через
// POST https://api.yookassa.ru/v3/payments (basic auth shopId:secretKey + Idempotence-Key).
// Активируется после регистрации магазина: BILLING_PROVIDER=yookassa.
export class YookassaPaymentProvider implements PaymentProvider {
  readonly name = 'YOOKASSA' as const

  async createPayment(): Promise<ProviderPayment> {
    throw new Error(
      'YooKassa provider is not configured. Set YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY and implement createPayment.'
    )
  }
}

export function createPaymentProvider(): PaymentProvider {
  const provider = (process.env.BILLING_PROVIDER || 'mock').toLowerCase()

  if (provider === 'yookassa') return new YookassaPaymentProvider()

  return new MockPaymentProvider()
}
