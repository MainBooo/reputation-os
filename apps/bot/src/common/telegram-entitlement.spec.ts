import { hasTelegramNotificationEntitlement } from './telegram-entitlement'

describe('hasTelegramNotificationEntitlement', () => {
  const now = new Date('2026-08-17T12:00:00.000Z')

  function membership(subscription: Record<string, unknown>, override?: boolean) {
    return {
      workspace: {
        featureOverrides: override === undefined ? [] : [{ value: override }],
        subscription,
      },
    }
  }

  it('allows an active workspace with the feature enabled', () => {
    expect(
      hasTelegramNotificationEntitlement(
        [
          membership({
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2026-08-18T12:00:00.000Z'),
            plan: { limits: { telegramNotifications: true } },
          }),
        ],
        now,
      ),
    ).toBe(true)
  })

  it('rejects an expired subscription even if its plan includes Telegram', () => {
    expect(
      hasTelegramNotificationEntitlement(
        [
          membership({
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2026-08-17T11:59:59.000Z'),
            plan: { limits: { telegramNotifications: true } },
          }),
        ],
        now,
      ),
    ).toBe(false)
  })

  it('applies a scheduled downgrade once it becomes due', () => {
    expect(
      hasTelegramNotificationEntitlement(
        [
          membership({
            status: 'ACTIVE',
            currentPeriodEnd: new Date('2026-08-18T12:00:00.000Z'),
            scheduledAt: new Date('2026-08-17T12:00:00.000Z'),
            plan: { limits: { telegramNotifications: true } },
            scheduledPlan: { limits: { telegramNotifications: false } },
          }),
        ],
        now,
      ),
    ).toBe(false)
  })

  it('uses an explicit feature override before the plan', () => {
    const activeSubscription = {
      status: 'MANUAL',
      plan: { limits: { telegramNotifications: true } },
    }

    expect(hasTelegramNotificationEntitlement([membership(activeSubscription, false)], now)).toBe(
      false,
    )
    expect(
      hasTelegramNotificationEntitlement(
        [membership({ status: 'CANCELED', plan: null }, true)],
        now,
      ),
    ).toBe(true)
  })
})
