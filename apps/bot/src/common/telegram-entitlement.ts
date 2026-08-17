type Plan = {
  limits?: Record<string, unknown> | null
} | null

type Subscription = {
  status?: string | null
  currentPeriodEnd?: Date | null
  trialEndsAt?: Date | null
  scheduledAt?: Date | null
  plan?: Plan
  scheduledPlan?: Plan
} | null

type Membership = {
  workspace?: {
    featureOverrides?: Array<{ value?: unknown }>
    subscription?: Subscription
  } | null
}

export function hasTelegramNotificationEntitlement(
  memberships: Membership[] | null | undefined,
  now = new Date(),
): boolean {
  return Boolean(
    memberships?.some((membership) => {
      const override = membership.workspace?.featureOverrides?.[0]
      if (override) return override.value === true

      const subscription = membership.workspace?.subscription
      const active =
        subscription &&
        ((subscription.status === 'ACTIVE' &&
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > now) ||
          subscription.status === 'MANUAL' ||
          (subscription.status === 'TRIAL' &&
            subscription.trialEndsAt &&
            subscription.trialEndsAt > now))

      if (!active) return false

      const effectivePlan =
        subscription.scheduledPlan &&
        subscription.scheduledAt &&
        subscription.scheduledAt <= now
          ? subscription.scheduledPlan
          : subscription.plan

      return effectivePlan?.limits?.telegramNotifications === true
    }),
  )
}
