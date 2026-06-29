import { randomUUID } from 'crypto'
import { Logger } from '@nestjs/common'

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

export class YookassaPaymentProvider implements PaymentProvider {
  readonly name = 'YOOKASSA' as const
  private readonly logger = new Logger(YookassaPaymentProvider.name)

  async createPayment(input: CheckoutInput): Promise<ProviderPayment> {
    const shopId = process.env.YOOKASSA_SHOP_ID
    const secretKey = process.env.YOOKASSA_SECRET_KEY

    if (!shopId || !secretKey) {
      throw new Error('YooKassa credentials not configured: YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY missing')
    }

    const credentials = Buffer.from(`${shopId}:${secretKey}`).toString('base64')

    const body = {
      amount: {
        value: Number(input.amount).toFixed(2),
        currency: 'RUB'
      },
      capture: true,
      description: input.description,
      confirmation: {
        type: 'redirect',
        return_url: input.returnUrl
      },
      metadata: input.metadata
    }

    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'Idempotence-Key': input.paymentId
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      this.logger.error(`YooKassa createPayment failed: HTTP ${response.status}`)
      throw new Error(`YooKassa API error: HTTP ${response.status}`)
    }

    const data: any = await response.json()

    const confirmationUrl: string | null =
      data?.confirmation?.confirmation_url ?? data?.confirmation?.redirect_url ?? null

    return {
      id: data.id,
      status: data.status ?? 'pending',
      confirmationUrl
    }
  }
}

export function createPaymentProvider(): PaymentProvider {
  const provider = (process.env.BILLING_PROVIDER || 'mock').toLowerCase()

  if (provider === 'yookassa') return new YookassaPaymentProvider()

  return new MockPaymentProvider()
}
