/**
 * Обновляет лимиты планов в БД, добавляя поля pushNotificationsEnabled,
 * webMonitoringEnabled, maxSources, maxMembers, maxWebPages.
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const PLAN_LIMITS = [
  {
    code: 'FREE',
    limits: {
      maxCompanies: 1,
      maxAiRepliesPerMonth: 5,
      platforms: ['YANDEX'],
      telegramNotifications: false,
      advancedAnalytics: false,
      pushNotificationsEnabled: false,
      webMonitoringEnabled: false,
      maxSources: 1,
      maxMembers: 1,
      maxWebPages: 0
    }
  },
  {
    code: 'START',
    limits: {
      maxCompanies: 3,
      maxAiRepliesPerMonth: 50,
      platforms: ['YANDEX', 'TWOGIS'],
      telegramNotifications: false,
      advancedAnalytics: false,
      pushNotificationsEnabled: true,
      webMonitoringEnabled: false,
      maxSources: 2,
      maxMembers: 2,
      maxWebPages: 0
    }
  },
  {
    code: 'PRO',
    limits: {
      maxCompanies: 10,
      maxAiRepliesPerMonth: -1,
      platforms: ['YANDEX', 'TWOGIS', 'WEB'],
      telegramNotifications: true,
      advancedAnalytics: true,
      pushNotificationsEnabled: true,
      webMonitoringEnabled: true,
      maxSources: 10,
      maxMembers: 5,
      maxWebPages: 20
    }
  },
  {
    code: 'AGENCY',
    limits: {
      maxCompanies: -1,
      maxAiRepliesPerMonth: -1,
      platforms: ['YANDEX', 'TWOGIS', 'WEB'],
      telegramNotifications: true,
      advancedAnalytics: true,
      pushNotificationsEnabled: true,
      webMonitoringEnabled: true,
      maxSources: -1,
      maxMembers: -1,
      maxWebPages: -1
    }
  }
]

async function main() {
  for (const plan of PLAN_LIMITS) {
    const existing = await prisma.plan.findUnique({ where: { code: plan.code } })
    if (!existing) {
      console.log(`SKIP plan ${plan.code}: not found in DB`)
      continue
    }
    await prisma.plan.update({
      where: { code: plan.code },
      data: { limits: plan.limits }
    })
    console.log(`Updated plan ${plan.code}: limits set`)
  }
  console.log('Done.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
