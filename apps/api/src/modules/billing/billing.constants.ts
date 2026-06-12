import { Platform } from '@prisma/client'

export interface PlanLimits {
  maxCompanies: number
  maxAiRepliesPerMonth: number // -1 = безлимит
  platforms: Platform[]
  telegramNotifications: boolean
  advancedAnalytics: boolean
}

export type FeatureKey = keyof PlanLimits

export const FREE_LIMITS: PlanLimits = {
  maxCompanies: 1,
  maxAiRepliesPerMonth: 5,
  platforms: [Platform.YANDEX],
  telegramNotifications: false,
  advancedAnalytics: false
}

export const FEATURE_KEYS: FeatureKey[] = [
  'maxCompanies',
  'maxAiRepliesPerMonth',
  'platforms',
  'telegramNotifications',
  'advancedAnalytics'
]
