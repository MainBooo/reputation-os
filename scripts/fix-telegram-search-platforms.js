/**
 * Приводит limits.platforms и limits.telegramMonitoringEnabled в Plan к тому,
 * что уже подразумевает CODE_DEFAULTS в entitlements.service.ts.
 *
 * Баг 1: assertTelegramMonitoringAllowed() в telegram-channels.service.ts требует
 * одновременно telegramMonitoringEnabled=true И platforms.includes('TELEGRAM').
 * В БД Plan.limits.platforms для PRO/AGENCY содержал только
 * ["YANDEX","TWOGIS","WEB"] — без TELEGRAM, поэтому Telegram Scout был недоступен
 * ВСЕМ тарифам, включая оплаченные.
 *
 * Баг 2: ключа telegramMonitoringEnabled не было в Plan.limits вообще ни у одного
 * тарифа — на авторизованном /billing/entitlements это маскировалось мёрджем с
 * CODE_DEFAULTS (entitlements.service.ts), но публичный GET /billing/plans отдаёт
 * limits из БД как есть, без мёрджа — поэтому карточки тарифов и таблица сравнения
 * не показывали строку «Поиск упоминаний в Telegram» ни для одного тарифа.
 *
 * Остальные ключи limits не трогаем.
 */
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TELEGRAM_MONITORING_BY_CODE = {
  FREE: false,
  START: false,
  PRO: true,
  AGENCY: true
}

async function main() {
  for (const [code, telegramMonitoringEnabled] of Object.entries(TELEGRAM_MONITORING_BY_CODE)) {
    const plan = await prisma.plan.findUnique({ where: { code } })
    if (!plan) {
      console.log(`SKIP ${code}: not found`)
      continue
    }
    const limits = plan.limits
    const platforms = Array.isArray(limits.platforms) ? limits.platforms : []
    const needsPlatform = telegramMonitoringEnabled && !platforms.includes('TELEGRAM')
    const needsFlag = limits.telegramMonitoringEnabled !== telegramMonitoringEnabled

    if (!needsPlatform && !needsFlag) {
      console.log(`SKIP ${code}: already correct`)
      continue
    }

    const updatedLimits = {
      ...limits,
      platforms: needsPlatform ? [...platforms, 'TELEGRAM'] : platforms,
      telegramMonitoringEnabled
    }
    await prisma.plan.update({ where: { code }, data: { limits: updatedLimits } })
    console.log(
      `Updated ${code}: telegramMonitoringEnabled=${updatedLimits.telegramMonitoringEnabled}, platforms=${JSON.stringify(updatedLimits.platforms)}`
    )
  }
  console.log('Done.')
}

main()
  .catch((err) => { console.error(err); process.exit(1) })
  .finally(() => prisma.$disconnect())
