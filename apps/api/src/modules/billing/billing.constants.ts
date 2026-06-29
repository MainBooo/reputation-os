import { Platform } from '@prisma/client'

export interface PlanLimits {
  maxCompanies: number
  maxAiRepliesPerMonth: number // -1 = безлимит
  platforms: Platform[]
  telegramNotifications: boolean
  advancedAnalytics: boolean
  // Extended limits (admin-configurable)
  maxSources: number            // -1 = безлимит
  maxMembers: number            // -1 = безлимит
  maxWebPages: number           // -1 = безлимит
  webMonitoringEnabled: boolean
  pushNotificationsEnabled: boolean
}

export type FeatureKey = keyof PlanLimits

export const FREE_LIMITS: PlanLimits = {
  maxCompanies: 1,
  maxAiRepliesPerMonth: 5,
  platforms: [Platform.YANDEX, Platform.TWOGIS],
  telegramNotifications: false,
  advancedAnalytics: false,
  maxSources: 2,
  maxMembers: 1,
  maxWebPages: 0,
  webMonitoringEnabled: false,
  pushNotificationsEnabled: true
}

export const FEATURE_KEYS: FeatureKey[] = [
  'maxCompanies',
  'maxAiRepliesPerMonth',
  'platforms',
  'telegramNotifications',
  'advancedAnalytics',
  'maxSources',
  'maxMembers',
  'maxWebPages',
  'webMonitoringEnabled',
  'pushNotificationsEnabled'
]
